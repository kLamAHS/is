"""
Churn Pre-Mortem: Executive Report Generator
=============================================

Generates the 3-page executive PDF deliverable.
"""

import numpy as np
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from dataclasses import dataclass
from typing import List, Tuple
from datetime import datetime


@dataclass
class ChurnAnalysisResult:
    """Results from the churn analysis"""
    company_name: str
    analysis_date: str
    scr_score: float
    exploration_score: float
    decisiveness_score: float
    weight_volatility: float
    regime_instability: float
    alpha_over_time: List[float]
    time_labels: List[str]
    user_count: int
    days_analyzed: int
    data_coverage: float
    regime: str
    wasted_money: List[str]
    wont_fix: List[str]
    strategic_moves: List[str]


def get_regime_from_scr(scr: float) -> Tuple[str, str, str]:
    """Returns (regime_name, verdict_headline, color_hex)"""
    if scr <= 25:
        return ("stable", "STRUCTURALLY STABLE", "#2E7D32")
    elif scr <= 50:
        return ("conditional", "CONDITIONALLY STABLE", "#F9A825")
    elif scr <= 75:
        return ("volatile", "STRUCTURALLY VOLATILE", "#E65100")
    else:
        return ("pre_churn", "PRE-CHURN STATE", "#C62828")


def get_verdict_text(scr: float, company_name: str) -> str:
    """Generate the one-sentence verdict"""
    if scr <= 25:
        return f"{company_name}'s users have made their choice. Retention is a solved problem here—further investment shows diminishing returns."
    elif scr <= 50:
        return f"{company_name}'s users are loyal but watchful. The relationship is maintained, not guaranteed. This is where retention ROI peaks."
    elif scr <= 75:
        return f"{company_name}'s users are actively comparing alternatives. Current engagement metrics are masking a population in exploration mode."
    else:
        return f"{company_name}'s users have mentally departed. What you're measuring is the lag between decision and action."


def get_wasted_money_items(regime: str) -> List[str]:
    """Generate 'where money is being wasted' items based on regime"""
    items = {
        "stable": [
            "Aggressive re-engagement campaigns to users who are already retained",
            "Discount/incentive programs that subsidize behavior that would happen anyway",
            "Over-investment in 'win-back' flows for natural, low-volume churn"
        ],
        "conditional": [
            "Broad retention campaigns that don't target the sensitivity triggers",
            "Feature development without user feedback loops on what's maintaining loyalty",
            "Treating all users identically when there's likely a bifurcated population"
        ],
        "volatile": [
            "Loyalty programs that reward frequency without addressing exploration drivers",
            "Acquisition spend that brings in users predisposed to the same volatility",
            "Feature parity responses to competitors instead of differentiation"
        ],
        "pre_churn": [
            "Any retention spend that doesn't acknowledge users have already decided",
            "Product improvements aimed at users who won't see them",
            "NPS or satisfaction surveys measuring a population that's already gone"
        ]
    }
    return items.get(regime, items["volatile"])


def get_wont_fix_items(regime: str) -> List[str]:
    """Generate 'what will not fix this' items based on regime"""
    items = {
        "stable": [
            "More onboarding optimization—your users already onboarded",
            "Churn prediction models—there's not enough signal to predict",
            "Customer success expansion—you're at the point of over-serving"
        ],
        "conditional": [
            "Generic email sequences without segmentation",
            "One-size-fits-all loyalty programs",
            "Waiting to see if it stabilizes on its own—it won't"
        ],
        "volatile": [
            "Doubling down on acquisition without fixing the leak",
            "Cosmetic product changes that don't address core comparison drivers",
            "Price cuts—you'll attract more volatile users at lower margins"
        ],
        "pre_churn": [
            "Retention campaigns—the decision is made",
            "Exit surveys—you'll get rationalization, not truth",
            "Urgent product pivots—too late for this cohort"
        ]
    }
    return items.get(regime, items["volatile"])


def get_strategic_moves(regime: str) -> List[Tuple[str, str]]:
    """Generate strategic moves with rationale"""
    moves = {
        "stable": [
            ("Shift retention budget to expansion revenue",
             "Your users stay. Now make staying more valuable for both sides."),
            ("Identify and protect the 'keystone' features",
             "Something is working. Find it, measure it, don't break it."),
            ("Use this cohort for acquisition targeting",
             "Model what brought stable users in. Acquire more of them.")
        ],
        "conditional": [
            ("Map sensitivity triggers through behavioral cohorts",
             "Find what pushes conditional users toward volatile. Instrument it."),
            ("Build early warning system on leading indicators",
             "You have time, but not infinite time. Know when the window closes."),
            ("Segment retention investment by stability score",
             "Not all users need the same intervention. Allocate accordingly.")
        ],
        "volatile": [
            ("Identify the comparison set",
             "Know who you're being compared to. Compete on defensible axes."),
            ("Accelerate habit formation for new users",
             "The volatility often starts early. Front-load the investment."),
            ("Build switching costs that add value, not friction",
             "Lock-in through capability, not inconvenience.")
        ],
        "pre_churn": [
            ("Accept the loss; protect the next cohort",
             "This group is gone. Learn from them, don't chase them."),
            ("Extract maximum signal on what broke",
             "Interview departing users now, while memory is fresh."),
            ("Audit acquisition channels for similar risk profiles",
             "You may be systematically attracting pre-churned users.")
        ]
    }
    return moves.get(regime, moves["volatile"])


def create_scr_gauge(scr: float, width: float = 400, height: float = 120) -> Drawing:
    """Create a visual gauge for the SCR score"""
    d = Drawing(width, height)

    bar_height = 30
    bar_y = height - 60

    segments = [
        (0, 25, "#2E7D32"),
        (25, 50, "#F9A825"),
        (50, 75, "#E65100"),
        (75, 100, "#C62828")
    ]

    for start, end, color in segments:
        x = 20 + (start / 100) * (width - 40)
        w = ((end - start) / 100) * (width - 40)
        d.add(Rect(x, bar_y, w, bar_height, fillColor=colors.HexColor(color), strokeColor=None))

    marker_x = 20 + (scr / 100) * (width - 40)
    d.add(Rect(marker_x - 3, bar_y - 10, 6, bar_height + 20,
               fillColor=colors.black, strokeColor=None))

    d.add(String(marker_x, bar_y - 25, f"{scr:.0f}",
                fontSize=18, fontName="Helvetica-Bold", textAnchor="middle"))

    labels = [("0", 20), ("25", 20 + 0.25*(width-40)),
              ("50", 20 + 0.5*(width-40)), ("75", 20 + 0.75*(width-40)),
              ("100", width - 20)]
    for text, x in labels:
        d.add(String(x, bar_y + bar_height + 10, text,
                    fontSize=9, fontName="Helvetica", textAnchor="middle"))

    cat_labels = [
        ("Stable", 20 + 0.125*(width-40)),
        ("Conditional", 20 + 0.375*(width-40)),
        ("Volatile", 20 + 0.625*(width-40)),
        ("Pre-Churn", 20 + 0.875*(width-40))
    ]
    for text, x in cat_labels:
        d.add(String(x, bar_y + bar_height + 25, text,
                    fontSize=8, fontName="Helvetica", textAnchor="middle"))

    return d


def create_alpha_chart(alpha_values: List[float], time_labels: List[str],
                       width: float = 450, height: float = 180) -> Drawing:
    """Create the signature alpha trajectory chart"""
    d = Drawing(width, height)

    chart = HorizontalLineChart()
    chart.x = 50
    chart.y = 30
    chart.width = width - 80
    chart.height = height - 60
    chart.data = [alpha_values]
    chart.lines[0].strokeColor = colors.HexColor("#1976D2")
    chart.lines[0].strokeWidth = 2
    chart.categoryAxis.categoryNames = time_labels
    chart.categoryAxis.labels.angle = 45
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.dy = -10
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = max(alpha_values) * 1.2
    chart.valueAxis.labels.fontSize = 8

    d.add(chart)
    d.add(String(width/2, height - 10, "Exploration Parameter (α) Over Time",
                fontSize=10, fontName="Helvetica-Bold", textAnchor="middle"))

    return d


def generate_report(result: ChurnAnalysisResult, output_path: str):
    """Generate the complete 3-page executive PDF"""

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'],
        fontSize=24, spaceAfter=6,
        textColor=colors.HexColor("#212121"), fontName="Helvetica-Bold"
    )

    subtitle_style = ParagraphStyle(
        'Subtitle', parent=styles['Normal'],
        fontSize=11, textColor=colors.HexColor("#616161"), spaceAfter=20
    )

    heading_style = ParagraphStyle(
        'SectionHeading', parent=styles['Heading2'],
        fontSize=14, spaceBefore=20, spaceAfter=10,
        textColor=colors.HexColor("#212121"), fontName="Helvetica-Bold"
    )

    body_style = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontSize=10, leading=14, spaceAfter=8,
        textColor=colors.HexColor("#424242")
    )

    verdict_style = ParagraphStyle(
        'Verdict', parent=styles['Normal'],
        fontSize=12, leading=16, spaceAfter=20,
        textColor=colors.HexColor("#212121"), fontName="Helvetica-Bold"
    )

    bullet_style = ParagraphStyle(
        'Bullet', parent=styles['Normal'],
        fontSize=10, leading=14, leftIndent=20, spaceAfter=6,
        textColor=colors.HexColor("#424242"), bulletIndent=10
    )

    regime, headline, color = get_regime_from_scr(result.scr_score)

    story = []

    # PAGE 1
    story.append(Paragraph("CHURN PRE-MORTEM", title_style))
    story.append(Paragraph(
        f"Structural Retention Analysis for {result.company_name}<br/>"
        f"Analysis Date: {result.analysis_date}",
        subtitle_style
    ))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E0E0E0")))
    story.append(Spacer(1, 20))

    score_headline_style = ParagraphStyle(
        'ScoreHeadline', parent=styles['Normal'],
        fontSize=48, textColor=colors.HexColor(color),
        fontName="Helvetica-Bold", alignment=TA_CENTER
    )

    story.append(Paragraph(f"SCR: {result.scr_score:.0f}", score_headline_style))

    regime_label_style = ParagraphStyle(
        'RegimeLabel', parent=styles['Normal'],
        fontSize=16, textColor=colors.HexColor(color),
        fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=20
    )
    story.append(Paragraph(headline, regime_label_style))

    gauge = create_scr_gauge(result.scr_score)
    story.append(gauge)
    story.append(Spacer(1, 20))

    verdict_text = get_verdict_text(result.scr_score, result.company_name)
    story.append(Paragraph(verdict_text, verdict_style))

    story.append(Spacer(1, 10))
    chart = create_alpha_chart(result.alpha_over_time, result.time_labels)
    story.append(chart)

    story.append(Spacer(1, 20))
    quality_style = ParagraphStyle(
        'Quality', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor("#9E9E9E")
    )
    story.append(Paragraph(
        f"Based on {result.user_count:,} users over {result.days_analyzed} days. "
        f"Data coverage: {result.data_coverage*100:.0f}%. "
        f"Component scores: Exploration={result.exploration_score:.2f}, "
        f"Decisiveness={result.decisiveness_score:.2f}, "
        f"Volatility={result.weight_volatility:.2f}, "
        f"Instability={result.regime_instability:.2f}",
        quality_style
    ))

    story.append(PageBreak())

    # PAGE 2
    story.append(Paragraph("WHERE MONEY IS BEING WASTED", heading_style))
    story.append(Paragraph(
        "Given the current structural state, these investments are likely destroying value:",
        body_style
    ))

    for item in result.wasted_money:
        story.append(Paragraph(f"• {item}", bullet_style))

    story.append(Spacer(1, 30))

    story.append(Paragraph("WHAT WILL NOT FIX THIS", heading_style))
    story.append(Paragraph(
        "The following interventions are commonly attempted but will not address the structural dynamics:",
        body_style
    ))

    for item in result.wont_fix:
        story.append(Paragraph(f"• {item}", bullet_style))

    story.append(Spacer(1, 30))

    story.append(Paragraph("DIAGNOSTIC BREAKDOWN", heading_style))

    component_data = [
        ["Component", "Score", "Interpretation"],
        ["Exploration (α)", f"{result.exploration_score:.2f}",
         "High = users actively comparing" if result.exploration_score > 0.5 else "Low = users settled"],
        ["Decisiveness", f"{result.decisiveness_score:.2f}",
         "High = strong preferences" if result.decisiveness_score > 0.5 else "Low = indifferent choices"],
        ["Weight Volatility", f"{result.weight_volatility:.2f}",
         "High = shifting priorities" if result.weight_volatility > 0.5 else "Low = stable criteria"],
        ["Regime Instability", f"{result.regime_instability:.2f}",
         "High = near tipping point" if result.regime_instability > 0.5 else "Low = stable equilibrium"]
    ]

    table = Table(component_data, colWidths=[1.8*inch, 0.8*inch, 3.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F5F5F5")),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(table)

    story.append(PageBreak())

    # PAGE 3
    story.append(Paragraph("WHAT CAN CHANGE THE TRAJECTORY", heading_style))
    story.append(Paragraph(
        "These interventions are calibrated to the current structural state. "
        "Ordered by expected leverage.",
        body_style
    ))
    story.append(Spacer(1, 10))

    moves = get_strategic_moves(regime)

    for i, (move, rationale) in enumerate(moves, 1):
        move_style = ParagraphStyle(
            f'Move{i}', parent=styles['Normal'],
            fontSize=11, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#212121"), spaceBefore=15, spaceAfter=4
        )
        story.append(Paragraph(f"{i}. {move}", move_style))
        story.append(Paragraph(rationale, body_style))

    story.append(Spacer(1, 30))

    story.append(Paragraph("WHAT TO WATCH", heading_style))
    story.append(Paragraph(
        "Leading indicators that will signal trajectory change before lagging metrics move:",
        body_style
    ))

    watch_items = {
        "stable": [
            "Feature usage breadth (are users exploring your product more?)",
            "Support ticket sentiment (early warning of emerging friction)",
            "Competitor mentions in feedback channels"
        ],
        "conditional": [
            "Session depth variance (are some users becoming shallow?)",
            "Time-to-second-action after events/releases",
            "Cohort divergence in engagement patterns"
        ],
        "volatile": [
            "New user 7-day retention (is the funnel filling with more volatiles?)",
            "Feature adoption velocity after releases",
            "Cross-platform usage if applicable"
        ],
        "pre_churn": [
            "Engagement frequency of remaining active users",
            "Acquisition channel performance (avoid compounding the problem)",
            "Win-back response rates for recent departures"
        ]
    }

    for item in watch_items.get(regime, watch_items["volatile"]):
        story.append(Paragraph(f"• {item}", bullet_style))

    story.append(Spacer(1, 40))

    footer_style = ParagraphStyle(
        'Footer', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor("#9E9E9E"), alignment=TA_CENTER
    )
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E0E0E0")))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "This analysis is based on behavioral modeling of user engagement patterns. "
        "Structural Churn Risk (SCR) is a diagnostic metric, not a prediction. "
        "Strategic recommendations should be validated against business context not captured in usage data.",
        footer_style
    ))

    doc.build(story)
    print(f"Report generated: {output_path}")
