/**
 * Entry point - imports all modules and initializes the application
 */

import { fetchAndRender } from './data.js';
import { restoreColumnState, toggleMinimize, toggleMaximize, handleColumnClick } from './columns.js';

// Export functions to window for inline event handlers
window.toggleMinimize = toggleMinimize;
window.toggleMaximize = toggleMaximize;
window.handleColumnClick = handleColumnClick;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    fetchAndRender();

    // Restore column state from localStorage
    restoreColumnState();

    // Auto-refresh every 1 second
    setInterval(fetchAndRender, 1000);
});
