/**
 * Entry point - initializes application and delegates rendering to views
 */

import {
  fetchBoardData,
  getBoardData,
  getProgressData,
  fetchTddData,
  getTddData,
} from './data.js';
import {
  boardView,
  getTokenMode,
  setTokenMode,
} from '../features/board/index.js';
import { tableView } from '../features/table/index.js';
import { initStores, uiStore } from '../shared/store/index.js';
import {
  restoreColumnState,
  toggleMinimize,
  toggleMaximize,
  handleColumnClick,
  toggleAutoCollapse,
} from '../features/board/columns.js';
import { initContextMenu } from '../features/context-menu/index.js';
import {
  initMetadataModal,
  clearCache as clearMetadataCache,
} from '../features/metadata-modal/index.js';
import { initTaskModal, showTaskModal } from '../features/task-modal/index.js';
import { taskbar } from '../shared/modal/index.js';
import { getIcon } from '../shared/utils/icons.js';
import { initSearch, reapplySearch } from '../features/search/index.js';

// Export functions to window for inline event handlers
window.toggleMinimize = toggleMinimize;
window.toggleMaximize = toggleMaximize;
window.toggleAutoCollapse = toggleAutoCollapse;
window.handleColumnClick = handleColumnClick;
window.openTaskModal = showTaskModal;

/**
 * Render both views with current data
 */
function render() {
  const boardData = getBoardData();
  const progressData = getProgressData();
  const tddData = getTddData();

  if (boardData) {
    boardView.render(boardData, progressData, tddData);
    tableView.render(boardData, progressData);
  }
}

// Export refreshBoard for context menu
window.refreshBoard = async () => {
  await fetchBoardData();
  await fetchTddData();
  render();
};

/**
 * Apply view mode to UI
 */
function applyView(mode) {
  const board = document.querySelector('.board');
  const tableViewEl = document.getElementById('table-view');
  const toggleBtn = document.getElementById('view-toggle');

  if (!board || !tableViewEl || !toggleBtn) return;

  if (mode === 'table') {
    board.classList.add('hidden');
    tableViewEl.classList.remove('hidden');
    toggleBtn.classList.add('active');
    toggleBtn.classList.add('rotated');
    toggleBtn.title = 'Switch to Board View';
  } else {
    board.classList.remove('hidden');
    tableViewEl.classList.add('hidden');
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
    const newMode = uiStore.toggleViewMode();
    applyView(newMode);
  });

  // Apply initial view mode
  applyView(uiStore.getViewMode());
}

/**
 * Initialize token mode selector (segmented control)
 */
function initTokenModeToggle() {
  const selector = document.getElementById('token-mode-selector');
  if (!selector) return;

  // Set initial active state from current mode
  const currentMode = getTokenMode();
  selector.querySelectorAll('.token-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });

  // Handle clicks on any button
  selector.addEventListener('click', (e) => {
    const btn = e.target.closest('.token-mode-btn');
    if (!btn) return;

    const mode = btn.dataset.mode;
    setTokenMode(mode);

    // Update active state
    selector.querySelectorAll('.token-mode-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });

    // Recalculate stats
    boardView.recalculateTokenStats();
  });
}

/**
 * Inject SVG icons into context menu elements
 */
function injectContextMenuIcons() {
  // Task context menu
  const taskHeaderIcon = document.getElementById('ctx-task-header-icon');
  const expandIcon = document.getElementById('ctx-expand-icon');
  const collapseIcon = document.getElementById('ctx-collapse-icon');
  const taskMetadataIcon = document.getElementById('ctx-task-metadata-icon');

  if (taskHeaderIcon) taskHeaderIcon.innerHTML = getIcon('file', 12);
  if (expandIcon) expandIcon.innerHTML = getIcon('folderOpen', 14);
  if (collapseIcon) collapseIcon.innerHTML = getIcon('folder', 14);
  if (taskMetadataIcon) taskMetadataIcon.innerHTML = getIcon('search', 14);

  // Board context menu
  const boardHeaderIcon = document.getElementById('ctx-board-header-icon');
  const boardTaskViewIcon = document.getElementById('ctx-board-task-view-icon');
  const boardCollapseIcon = document.getElementById('ctx-board-collapse-icon');
  const boardExpandIcon = document.getElementById('ctx-board-expand-icon');
  const boardMetadataIcon = document.getElementById('ctx-board-metadata-icon');

  if (boardHeaderIcon) boardHeaderIcon.innerHTML = getIcon('board', 12);
  if (boardTaskViewIcon) boardTaskViewIcon.innerHTML = getIcon('clipboard', 14);
  if (boardCollapseIcon) boardCollapseIcon.innerHTML = getIcon('folder', 14);
  if (boardExpandIcon) boardExpandIcon.innerHTML = getIcon('folderOpen', 14);
  if (boardMetadataIcon) boardMetadataIcon.innerHTML = getIcon('search', 14);

  // Column context menu
  const columnHeaderIcon = document.getElementById('ctx-column-header-icon');
  const columnTaskViewIcon = document.getElementById(
    'ctx-column-task-view-icon'
  );
  const columnCollapseIcon = document.getElementById(
    'ctx-column-collapse-icon'
  );
  const columnExpandIcon = document.getElementById('ctx-column-expand-icon');
  const columnMetadataIcon = document.getElementById(
    'ctx-column-metadata-icon'
  );

  if (columnHeaderIcon) columnHeaderIcon.innerHTML = getIcon('board', 12);
  if (columnTaskViewIcon)
    columnTaskViewIcon.innerHTML = getIcon('clipboard', 14);
  if (columnCollapseIcon) columnCollapseIcon.innerHTML = getIcon('folder', 14);
  if (columnExpandIcon) columnExpandIcon.innerHTML = getIcon('folderOpen', 14);
  if (columnMetadataIcon) columnMetadataIcon.innerHTML = getIcon('search', 14);
}

/**
 * Inject SVG icons into auto-collapse buttons
 */
function injectAutoButtonIcons() {
  const autoButtons = document.querySelectorAll('.auto-btn');
  autoButtons.forEach((btn) => {
    btn.innerHTML = getIcon('refresh', 14);
  });

  // Also inject into minimized indicators
  const autoIndicators = document.querySelectorAll('.auto-indicator');
  autoIndicators.forEach((indicator) => {
    indicator.innerHTML = getIcon('refresh', 14);
  });
}

/**
 * Initialize the application
 */
async function init() {
  // Initialize stores (loads persisted state from localStorage)
  initStores();

  // Initial data load and render
  await fetchBoardData();
  await fetchTddData();
  render();
  reapplySearch();

  // Restore column state from localStorage
  restoreColumnState();

  // Initialize context menu
  initContextMenu();

  // Inject SVG icons into context menus
  injectContextMenuIcons();

  // Inject SVG icons into auto-collapse buttons
  injectAutoButtonIcons();

  // Initialize taskbar singleton (before modals so callbacks can be registered)
  taskbar.setup();

  // Initialize modals
  initMetadataModal();
  initTaskModal();

  // Initialize task search
  initSearch();

  // Initialize view toggle
  initViewToggle();

  // Initialize token mode toggle
  initTokenModeToggle();

  // Initialize table sort
  tableView.initSort();

  // Auto-refresh every 1 second (only re-render when data changes)
  setInterval(async () => {
    const hasChanged = await fetchBoardData();
    await fetchTddData(); // Always refresh TDD data
    if (hasChanged) {
      render();
      reapplySearch();
      clearMetadataCache();
    }
  }, 1000);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
