/**
 * Entry point - imports all modules and initializes the application
 */

import { fetchAndRender, getBoardData, getProgressData } from './data.js';
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
import { initSearch, reapplySearch } from './search.js';
import { renderTable, initTableSort } from './table.js';

const VIEW_MODE_KEY = 'kanban-view-mode';

// Export functions to window for inline event handlers
window.toggleMinimize = toggleMinimize;
window.toggleMaximize = toggleMaximize;
window.handleColumnClick = handleColumnClick;

// Export refreshBoard for context menu
window.refreshBoard = fetchAndRender;

/**
 * Get current view mode from localStorage
 */
function getViewMode() {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) || 'board';
  } catch {
    return 'board';
  }
}

/**
 * Save view mode to localStorage
 */
function saveViewMode(mode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Apply view mode to UI
 */
function applyView(mode) {
  const board = document.querySelector('.board');
  const tableView = document.getElementById('table-view');
  const toggleBtn = document.getElementById('view-toggle');

  if (!board || !tableView || !toggleBtn) return;

  if (mode === 'table') {
    board.classList.add('hidden');
    tableView.classList.remove('hidden');
    toggleBtn.classList.add('active');
    toggleBtn.classList.add('rotated');
    toggleBtn.title = 'Switch to Board View';
  } else {
    board.classList.remove('hidden');
    tableView.classList.add('hidden');
    toggleBtn.classList.remove('active');
    toggleBtn.classList.remove('rotated');
    toggleBtn.title = 'Switch to Table View';
  }
}

/**
 * Initialize view toggle
 */
function initViewToggle() {
  const toggleBtn = document.getElementById('view-toggle');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const currentMode = getViewMode();
    const newMode = currentMode === 'board' ? 'table' : 'board';
    saveViewMode(newMode);
    applyView(newMode);
  });

  // Apply initial view mode
  applyView(getViewMode());
}

/**
 * Update table when data changes
 */
function updateTableView() {
  const boardData = getBoardData();
  const progressData = getProgressData();
  if (boardData && progressData) {
    renderTable(boardData, progressData);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initial load
  fetchAndRender().then(() => {
    updateTableView();
    reapplySearch();
  });

  // Restore column state from localStorage
  restoreColumnState();

  // Initialize context menu
  initContextMenu();

  // Initialize metadata modal
  initMetadataModal();

  // Initialize task search
  initSearch();

  // Initialize view toggle
  initViewToggle();

  // Initialize table sort
  initTableSort();

  // Auto-refresh every 1 second (also clears metadata cache and updates table)
  setInterval(() => {
    fetchAndRender().then(() => {
      updateTableView();
      reapplySearch();
    });
    clearMetadataCache();
  }, 1000);
});
