// ==================== LEADERBOARD SYSTEM ====================
// Firebase-powered global leaderboard for Havenvoy

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getDatabase,
    ref,
    push,
    query,
    orderByChild,
    limitToLast,
    get,
    set,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ==================== FIREBASE CONFIG ====================
// IMPORTANT: Replace this with your own Firebase config!
// See FIREBASE_SETUP.md for instructions
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Leaderboard categories
const LEADERBOARD_CATEGORIES = {
    netWorth: {
        id: 'netWorth',
        name: 'Richest Captains',
        icon: '💰',
        description: 'Highest net worth (gold + cargo value)',
        getValue: (gs) => {
            const cargoValue = Object.entries(gs.player?.cargo || {}).reduce((sum, [goodId, qty]) => {
                const basePrice = window.CONFIG?.goods?.[goodId]?.basePrice || 0;
                return sum + (basePrice * qty);
            }, 0);
            return Math.floor((gs.player?.gold || 0) + cargoValue);
        },
        format: (val) => `${val.toLocaleString()}g`
    },
    daysAtSea: {
        id: 'daysAtSea',
        name: 'Longest Voyages',
        icon: '📅',
        description: 'Most days survived at sea',
        getValue: (gs) => gs.player?.days || 1,
        format: (val) => `${val} days`
    },
    contractsCompleted: {
        id: 'contractsCompleted',
        name: 'Top Contractors',
        icon: '📜',
        description: 'Most contracts completed',
        getValue: (gs) => gs.player?.stats?.contractsCompleted || 0,
        format: (val) => `${val} contracts`
    },
    questlinesCompleted: {
        id: 'questlinesCompleted',
        name: 'Legendary Captains',
        icon: '🏆',
        description: 'Most questlines completed',
        getValue: (gs) => gs.player?.stats?.questlinesCompleted || 0,
        format: (val) => `${val} questlines`
    },
    tradingProfit: {
        id: 'tradingProfit',
        name: 'Master Traders',
        icon: '📈',
        description: 'Highest lifetime trading profit',
        getValue: (gs) => gs.player?.stats?.totalProfit || 0,
        format: (val) => `${val.toLocaleString()}g`
    }
};

// ==================== LEADERBOARD CLASS ====================
class Leaderboard {
    constructor() {
        this.app = null;
        this.db = null;
        this.initialized = false;
        this.playerName = localStorage.getItem('havenvoy_playerName') || '';
        this.categories = LEADERBOARD_CATEGORIES;
    }

    // Initialize Firebase connection
    async init() {
        // Check if config is set up
        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            console.warn('Leaderboard: Firebase not configured. See FIREBASE_SETUP.md');
            return false;
        }

        try {
            this.app = initializeApp(firebaseConfig);
            this.db = getDatabase(this.app);
            this.initialized = true;
            console.log('Leaderboard: Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Leaderboard: Failed to initialize Firebase', error);
            return false;
        }
    }

    // Check if leaderboard is available
    isAvailable() {
        return this.initialized;
    }

    // Set player name
    setPlayerName(name) {
        const sanitized = this.sanitizeName(name);
        this.playerName = sanitized;
        localStorage.setItem('havenvoy_playerName', sanitized);
        return sanitized;
    }

    // Get player name
    getPlayerName() {
        return this.playerName;
    }

    // Sanitize player name
    sanitizeName(name) {
        return name
            .trim()
            .slice(0, 20)
            .replace(/[<>\"'&]/g, '') // Remove potentially dangerous chars
            .replace(/\s+/g, ' '); // Normalize whitespace
    }

    // Basic validation - check if score seems legitimate
    validateScore(category, value, gameState) {
        if (!gameState) return false;
        if (typeof value !== 'number' || isNaN(value)) return false;
        if (value < 0) return false;

        const day = gameState.player?.days || 1;

        // Basic sanity checks based on game day
        switch (category) {
            case 'netWorth':
                // Max reasonable wealth grows with time
                const maxWealth = 1000 + (day * 500); // Starting gold + reasonable daily gain
                if (value > maxWealth * 10) return false; // Allow 10x for exceptional play
                break;
            case 'daysAtSea':
                if (value > 10000) return false; // Reasonable cap
                break;
            case 'contractsCompleted':
                // Can't complete more than ~2 contracts per day on average
                if (value > day * 3) return false;
                break;
            case 'questlinesCompleted':
                // Questlines take time
                if (value > Math.ceil(day / 10)) return false;
                break;
            case 'tradingProfit':
                // Similar to net worth
                const maxProfit = day * 1000;
                if (value > maxProfit * 10) return false;
                break;
        }

        return true;
    }

    // Submit a score to a category
    async submitScore(categoryId, gameState) {
        if (!this.initialized) {
            console.warn('Leaderboard: Not initialized');
            return { success: false, error: 'Leaderboard not available' };
        }

        if (!this.playerName) {
            return { success: false, error: 'Please enter a name first' };
        }

        const category = this.categories[categoryId];
        if (!category) {
            return { success: false, error: 'Invalid category' };
        }

        const value = category.getValue(gameState);

        // Validate score
        if (!this.validateScore(categoryId, value, gameState)) {
            console.warn('Leaderboard: Score validation failed', categoryId, value);
            return { success: false, error: 'Score validation failed' };
        }

        try {
            const scoreRef = ref(this.db, `leaderboard/${categoryId}`);
            const newScoreRef = push(scoreRef);

            await set(newScoreRef, {
                name: this.playerName,
                score: value,
                faction: gameState.player?.faction || 'unknown',
                day: gameState.player?.days || 1,
                timestamp: Date.now()
            });

            console.log(`Leaderboard: Submitted ${categoryId} score: ${value}`);
            return { success: true, score: value };
        } catch (error) {
            console.error('Leaderboard: Failed to submit score', error);
            return { success: false, error: 'Failed to submit score' };
        }
    }

    // Submit all scores at once
    async submitAllScores(gameState) {
        if (!this.initialized || !this.playerName) {
            return { success: false, error: 'Not ready to submit' };
        }

        const results = {};
        for (const categoryId of Object.keys(this.categories)) {
            results[categoryId] = await this.submitScore(categoryId, gameState);
        }
        return results;
    }

    // Get top scores for a category
    async getTopScores(categoryId, limit = 10) {
        if (!this.initialized) {
            return { success: false, error: 'Leaderboard not available', scores: [] };
        }

        const category = this.categories[categoryId];
        if (!category) {
            return { success: false, error: 'Invalid category', scores: [] };
        }

        try {
            const scoreRef = ref(this.db, `leaderboard/${categoryId}`);
            const topScoresQuery = query(scoreRef, orderByChild('score'), limitToLast(limit));
            const snapshot = await get(topScoresQuery);

            const scores = [];
            snapshot.forEach((child) => {
                scores.push({
                    id: child.key,
                    ...child.val()
                });
            });

            // Sort descending (Firebase limitToLast returns ascending)
            scores.sort((a, b) => b.score - a.score);

            return { success: true, scores };
        } catch (error) {
            console.error('Leaderboard: Failed to fetch scores', error);
            return { success: false, error: 'Failed to fetch scores', scores: [] };
        }
    }

    // Get player's best scores
    async getPlayerBestScores() {
        if (!this.initialized || !this.playerName) {
            return {};
        }

        const results = {};
        for (const categoryId of Object.keys(this.categories)) {
            const { scores } = await this.getTopScores(categoryId, 100);
            const playerScores = scores.filter(s => s.name === this.playerName);
            if (playerScores.length > 0) {
                results[categoryId] = Math.max(...playerScores.map(s => s.score));
            }
        }
        return results;
    }

    // Get category info
    getCategories() {
        return this.categories;
    }

    // Format a score for display
    formatScore(categoryId, value) {
        const category = this.categories[categoryId];
        return category ? category.format(value) : String(value);
    }
}

// Create singleton instance
const leaderboard = new Leaderboard();

// Export
export { leaderboard, LEADERBOARD_CATEGORIES };
