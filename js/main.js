// ==================== MAIN ENTRY POINT ====================
// Initializes the game and handles startup logic

import { Game } from './game.js';

console.log('Module loaded - Three.js ready:', !!window.THREE);

// Initialize game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    try {
        window.game = new Game();
    } catch (e) {
        console.error('Failed to create game:', e);
        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('faction-screen')?.classList.remove('hidden');
    }
});

// Fallback: if still loading after 10 seconds, force show faction screen
setTimeout(() => {
    const loading = document.getElementById('loading-screen');
    if (loading && !loading.classList.contains('hidden')) {
        console.warn('Loading timeout - forcing faction screen');
        loading.classList.add('hidden');
        document.getElementById('faction-screen')?.classList.remove('hidden');
    }
}, 10000);

// Export Game class for external access if needed
export { Game };
