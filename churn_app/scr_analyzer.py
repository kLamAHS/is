"""
Structural Churn Risk (SCR) Analysis Engine
============================================

Computes SCR score from user event data.
Handles messy data gracefully with explicit assumptions.

Input: User event stream (user_id, timestamp, action)
Output: SCR score + component breakdown
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import warnings


@dataclass
class DataQualityReport:
    """Documents data quality and assumptions"""
    total_events: int
    total_users: int
    date_range_days: int
    coverage_pct: float

    missing_user_ids: int
    missing_timestamps: int
    duplicate_events: int

    assumptions: List[str]
    warnings: List[str]


@dataclass
class SCRResult:
    """Complete SCR analysis result"""
    # Core score
    scr_score: float  # 0-100

    # Components (0-1 each)
    exploration_score: float
    decisiveness_score: float
    weight_volatility: float
    regime_instability: float

    # Time series
    alpha_trajectory: List[float]
    time_periods: List[str]

    # Metadata
    user_count: int
    days_analyzed: int
    data_coverage: float

    # Quality
    quality_report: DataQualityReport

    # Regime
    regime: str
    confidence: str  # "high", "medium", "low"


class SCRAnalyzer:
    """
    Computes Structural Churn Risk from user behavior data.

    The analysis models each user as a behavioral agent with:
    - Exploration parameter α (tendency to try alternatives)
    - Decisiveness s (strength of preference)
    - Feature weights (what drives choices)

    Population-level aggregates reveal structural stability.
    """

    def __init__(self, min_users: int = 100, min_days: int = 30):
        self.min_users = min_users
        self.min_days = min_days
        self.assumptions = []
        self.warnings = []

    def _validate_and_clean(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, DataQualityReport]:
        """Validate input data and document quality"""

        original_rows = len(df)
        self.assumptions = []
        self.warnings = []

        # Required columns
        required = ['user_id', 'timestamp']
        missing_cols = [c for c in required if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")

        # If no action column, create synthetic one
        if 'action' not in df.columns:
            df['action'] = 'event'
            self.assumptions.append("No action types provided; treating all events as equivalent")

        # Track issues
        missing_user_ids = df['user_id'].isna().sum()
        missing_timestamps = df['timestamp'].isna().sum()

        # Clean
        df = df.dropna(subset=['user_id', 'timestamp'])

        # Parse timestamps
        if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            failed_parse = df['timestamp'].isna().sum()
            if failed_parse > 0:
                self.warnings.append(f"{failed_parse} timestamps failed to parse and were dropped")
            df = df.dropna(subset=['timestamp'])

        # Detect and handle duplicates
        duplicates = df.duplicated(subset=['user_id', 'timestamp', 'action']).sum()
        if duplicates > 0:
            df = df.drop_duplicates(subset=['user_id', 'timestamp', 'action'])
            self.assumptions.append(f"Removed {duplicates} duplicate events")

        # Sort by time
        df = df.sort_values('timestamp')

        # Compute coverage
        date_range = (df['timestamp'].max() - df['timestamp'].min()).days + 1
        expected_user_days = len(df['user_id'].unique()) * date_range
        actual_user_days = df.groupby('user_id')['timestamp'].apply(
            lambda x: (x.max() - x.min()).days + 1
        ).sum()
        coverage = min(1.0, actual_user_days / max(1, expected_user_days))

        # Quality report
        quality = DataQualityReport(
            total_events=len(df),
            total_users=df['user_id'].nunique(),
            date_range_days=date_range,
            coverage_pct=coverage,
            missing_user_ids=missing_user_ids,
            missing_timestamps=missing_timestamps,
            duplicate_events=duplicates,
            assumptions=self.assumptions.copy(),
            warnings=self.warnings.copy()
        )

        # Validation warnings
        if quality.total_users < self.min_users:
            self.warnings.append(f"User count ({quality.total_users}) below recommended minimum ({self.min_users})")

        if quality.date_range_days < self.min_days:
            self.warnings.append(f"Date range ({quality.date_range_days} days) below recommended minimum ({self.min_days})")

        return df, quality

    def _compute_user_alpha(self, user_df: pd.DataFrame, all_actions: set) -> Tuple[float, List[float]]:
        """
        Compute exploration parameter for a single user.

        α is high when user tries many different actions/paths
        α is low when user sticks to consistent patterns
        """
        actions = user_df['action'].tolist()

        if len(actions) < 2:
            return 0.5, [0.5]  # Neutral for insufficient data

        # Measure: action diversity over time
        window_size = max(5, len(actions) // 10)
        alpha_trajectory = []

        for i in range(0, len(actions), window_size):
            window = actions[i:i+window_size]
            if len(window) < 2:
                continue

            # Diversity within window (normalized entropy)
            from collections import Counter
            counts = Counter(window)
            probs = np.array(list(counts.values())) / len(window)
            entropy = -np.sum(probs * np.log(probs + 1e-10))
            max_entropy = np.log(len(all_actions) + 1e-10)
            normalized_entropy = entropy / max_entropy if max_entropy > 0 else 0

            # Also consider: switching rate within window
            switches = sum(1 for j in range(1, len(window)) if window[j] != window[j-1])
            switch_rate = switches / (len(window) - 1)

            # Combined alpha
            alpha = 0.6 * normalized_entropy + 0.4 * switch_rate
            alpha_trajectory.append(alpha)

        if not alpha_trajectory:
            return 0.5, [0.5]

        return np.mean(alpha_trajectory), alpha_trajectory

    def _compute_user_decisiveness(self, user_df: pd.DataFrame) -> float:
        """
        Compute decisiveness for a single user.

        High decisiveness: Clear patterns, consistent choices
        Low decisiveness: Random-seeming behavior, no clear preference
        """
        actions = user_df['action'].tolist()

        if len(actions) < 3:
            return 0.5

        from collections import Counter
        counts = Counter(actions)
        total = len(actions)

        # Measure: How concentrated are choices?
        max_share = max(counts.values()) / total

        # Measure: Are choices becoming more concentrated over time?
        first_half = actions[:len(actions)//2]
        second_half = actions[len(actions)//2:]

        first_max = max(Counter(first_half).values()) / len(first_half) if first_half else 0
        second_max = max(Counter(second_half).values()) / len(second_half) if second_half else 0

        concentration_trend = 0.5 + 0.5 * (second_max - first_max)  # 0 to 1

        decisiveness = 0.6 * max_share + 0.4 * concentration_trend
        return np.clip(decisiveness, 0, 1)

    def _compute_weight_volatility(self, df: pd.DataFrame) -> float:
        """
        Compute how much user preferences are shifting over time.

        Operationalized as: instability in action type distributions across time windows
        """
        # Divide into time windows
        df = df.copy()
        df['week'] = df['timestamp'].dt.isocalendar().week + df['timestamp'].dt.year * 52

        weekly_distributions = []
        for week, week_df in df.groupby('week'):
            action_counts = week_df['action'].value_counts(normalize=True)
            weekly_distributions.append(action_counts)

        if len(weekly_distributions) < 2:
            return 0.5  # Insufficient data

        # Measure distribution changes between consecutive weeks
        volatilities = []
        for i in range(1, len(weekly_distributions)):
            prev_dist = weekly_distributions[i-1]
            curr_dist = weekly_distributions[i]

            # Jensen-Shannon style divergence (simplified)
            all_actions = set(prev_dist.index) | set(curr_dist.index)
            divergence = 0
            for action in all_actions:
                p = prev_dist.get(action, 0)
                q = curr_dist.get(action, 0)
                divergence += abs(p - q)

            volatilities.append(divergence / 2)  # Normalize to 0-1

        return np.mean(volatilities)

    def _compute_regime_instability(self, alpha_values: List[float]) -> float:
        """
        Detect if the system is near a tipping point.

        High instability: α is trending, high variance, autocorrelation breaking down
        Low instability: α is stable, low variance, consistent dynamics
        """
        if len(alpha_values) < 3:
            return 0.5

        alpha_arr = np.array(alpha_values)

        # Trend component
        x = np.arange(len(alpha_arr))
        slope = np.polyfit(x, alpha_arr, 1)[0]
        trend_strength = min(1.0, abs(slope) * 10)  # Normalize

        # Variance component
        variance = np.var(alpha_arr)
        variance_score = min(1.0, variance * 4)  # Normalize

        # Recent acceleration
        if len(alpha_arr) >= 6:
            first_half_slope = np.polyfit(x[:len(x)//2], alpha_arr[:len(x)//2], 1)[0]
            second_half_slope = np.polyfit(x[len(x)//2:], alpha_arr[len(x)//2:], 1)[0]
            acceleration = abs(second_half_slope - first_half_slope)
            accel_score = min(1.0, acceleration * 10)
        else:
            accel_score = 0.5

        instability = 0.4 * trend_strength + 0.3 * variance_score + 0.3 * accel_score
        return np.clip(instability, 0, 1)

    def _aggregate_alpha_trajectory(self, user_trajectories: Dict[str, List[float]],
                                     n_periods: int = 12) -> List[float]:
        """Aggregate user-level alpha trajectories into population trajectory"""

        # Normalize all trajectories to same length
        normalized = []
        for user_id, trajectory in user_trajectories.items():
            if len(trajectory) >= 3:
                # Interpolate to n_periods
                indices = np.linspace(0, len(trajectory) - 1, n_periods)
                interp = np.interp(indices, range(len(trajectory)), trajectory)
                normalized.append(interp)

        if not normalized:
            return [0.5] * n_periods

        # Median across users (robust to outliers)
        population_trajectory = np.median(normalized, axis=0).tolist()
        return population_trajectory

    def analyze(self, df: pd.DataFrame) -> SCRResult:
        """
        Run complete SCR analysis on event data.

        Args:
            df: DataFrame with columns [user_id, timestamp, action (optional)]

        Returns:
            SCRResult with score and components
        """
        # Validate and clean
        df, quality = self._validate_and_clean(df)

        # Get all possible actions
        all_actions = set(df['action'].unique())

        # Compute per-user metrics
        user_alphas = {}
        user_alpha_trajectories = {}
        user_decisiveness = {}

        for user_id, user_df in df.groupby('user_id'):
            if len(user_df) < 3:
                continue

            alpha, alpha_traj = self._compute_user_alpha(user_df, all_actions)
            user_alphas[user_id] = alpha
            user_alpha_trajectories[user_id] = alpha_traj
            user_decisiveness[user_id] = self._compute_user_decisiveness(user_df)

        if len(user_alphas) < 10:
            self.warnings.append("Very few users with sufficient activity for reliable analysis")

        # Aggregate to population level
        exploration_score = np.mean(list(user_alphas.values())) if user_alphas else 0.5
        decisiveness_score = np.mean(list(user_decisiveness.values())) if user_decisiveness else 0.5
        weight_volatility = self._compute_weight_volatility(df)

        # Alpha trajectory
        alpha_trajectory = self._aggregate_alpha_trajectory(user_alpha_trajectories)

        # Regime instability
        regime_instability = self._compute_regime_instability(alpha_trajectory)

        # Compute SCR score
        scr_score = 100 * (
            0.35 * exploration_score +
            0.25 * (1 - decisiveness_score) +
            0.25 * weight_volatility +
            0.15 * regime_instability
        )
        scr_score = np.clip(scr_score, 0, 100)

        # Determine regime
        if scr_score <= 25:
            regime = "stable"
        elif scr_score <= 50:
            regime = "conditional"
        elif scr_score <= 75:
            regime = "volatile"
        else:
            regime = "pre_churn"

        # Confidence assessment
        if quality.total_users >= 500 and quality.date_range_days >= 90 and quality.coverage_pct >= 0.8:
            confidence = "high"
        elif quality.total_users >= 200 and quality.date_range_days >= 60 and quality.coverage_pct >= 0.6:
            confidence = "medium"
        else:
            confidence = "low"

        # Generate time period labels
        start_date = df['timestamp'].min()
        time_periods = [
            (start_date + timedelta(days=i * quality.date_range_days // 12)).strftime('%b %d')
            for i in range(12)
        ]

        return SCRResult(
            scr_score=scr_score,
            exploration_score=exploration_score,
            decisiveness_score=decisiveness_score,
            weight_volatility=weight_volatility,
            regime_instability=regime_instability,
            alpha_trajectory=alpha_trajectory,
            time_periods=time_periods,
            user_count=quality.total_users,
            days_analyzed=quality.date_range_days,
            data_coverage=quality.coverage_pct,
            quality_report=quality,
            regime=regime,
            confidence=confidence
        )


def create_synthetic_data(n_users: int = 500, n_days: int = 90,
                          regime: str = "conditional") -> pd.DataFrame:
    """
    Generate synthetic event data for testing.
    """
    np.random.seed(42)

    actions = ['view', 'click', 'search', 'purchase', 'share', 'return']

    regime_params = {
        "stable": {"switch_prob": 0.1, "action_concentration": 0.7, "engagement_decay": 0.02},
        "conditional": {"switch_prob": 0.25, "action_concentration": 0.5, "engagement_decay": 0.05},
        "volatile": {"switch_prob": 0.45, "action_concentration": 0.35, "engagement_decay": 0.08},
        "pre_churn": {"switch_prob": 0.6, "action_concentration": 0.2, "engagement_decay": 0.15}
    }

    params = regime_params.get(regime, regime_params["conditional"])

    events = []
    start_date = datetime.now() - timedelta(days=n_days)

    for user_id in range(n_users):
        preferred_idx = np.random.randint(len(actions))
        base_events_per_day = np.random.uniform(1, 5)
        current_preferred = preferred_idx

        for day in range(n_days):
            decay_factor = np.exp(-params['engagement_decay'] * day / n_days)
            events_today = np.random.poisson(base_events_per_day * decay_factor)

            for _ in range(events_today):
                if np.random.random() < params['switch_prob'] / 30:
                    current_preferred = np.random.randint(len(actions))

                if np.random.random() < params['action_concentration']:
                    action = actions[current_preferred]
                else:
                    action = np.random.choice(actions)

                timestamp = start_date + timedelta(
                    days=day,
                    hours=np.random.randint(24),
                    minutes=np.random.randint(60)
                )

                events.append({
                    'user_id': f"user_{user_id}",
                    'timestamp': timestamp,
                    'action': action
                })

    return pd.DataFrame(events)
