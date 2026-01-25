/**
 * Entry point - imports all modules and initializes the application
 */

import { fetchAndRender } from './data.js';
import {
  restoreColumnState,
  toggleMinimize,
  toggleMaximize,
  handleColumnClick,
} from './columns.js';
import { initContextMenu } from './context-menu.js';
import {
  initMetadataModal,
  clearCache as clearMetadataCache,
} from './metadata-modal.js';
import { initSearch } from './search.js';

// Export functions to window for inline event handlers
window.toggleMinimize = toggleMinimize;
window.toggleMaximize = toggleMaximize;
window.handleColumnClick = handleColumnClick;

// Export refreshBoard for context menu
window.refreshBoard = fetchAndRender;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initial load
  fetchAndRender();

  // Restore column state from localStorage
  restoreColumnState();

  // Initialize context menu
  initContextMenu();

  // Initialize metadata modal
  initMetadataModal();

  // Initialize task search
  initSearch();

  // Auto-refresh every 1 second (also clears metadata cache)
  setInterval(() => {
    fetchAndRender();
    clearMetadataCache();
  }, 1000);
});
