/**
 * Metadata modal for viewing task JSON data
 */

import { getTaskStatus as getTaskStatusFromBoard } from './tasks.js';

let modalElement = null;
let overlayElement = null;
let currentTaskName = null;

// Cached data
let boardDataCache = null;
let progressDataCache = null;
const logDataCache = new Map();
const outputDataCache = new Map();
const promptDataCache = new Map();

// QA mode state
let isQaMode = false;

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let modalStartX = 0;
let modalStartY = 0;

// Resize state
let isResizing = false;
let resizeDirection = '';
let resizeStartX = 0;
let resizeStartY = 0;
let modalStartWidth = 0;
let modalStartHeight = 0;
let modalStartLeft = 0;
let modalStartTop = 0;

const MIN_WIDTH = 500;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 600;
const MODAL_SIZE_KEY = 'kanban-metadata-modal-size';
const FULLSCREEN_STATE_KEY = 'kanban-modal-fullscreen';

// Auto-refresh state
let refreshInterval = null;
let currentTabData = null;
let currentTabName = null;

// Search state
let searchDebounceTimer = null;
let searchAbortController = null;
let searchMatches = [];
let currentMatchIndex = -1;

// Maximize state
let isMaximized = false;
let preMaximizeState = { width: 0, height: 0, left: 0, top: 0 };

// Minimize state
const minimizedModals = new Map(); // taskName -> { title, mode, columnId, taskNames }

// Open modal state (for taskbar display)
let openModalInfo = null; // { key, title, mode, columnId, taskNames, taskName }

// Taskbar collapsed state
let taskbarCollapsed = false;
const TASKBAR_STATE_KEY = 'kanban-taskbar-collapsed';

// Column mode state
let isColumnMode = false;
let currentColumnId = null;
let columnTasks = [];
let selectedTaskIndex = 0;

// Sidebar state
let sidebarCollapsed = false;
let sidebarWidth = 200;
let isSidebarResizing = false;
let sidebarResizeStartX = 0;
let sidebarStartWidth = 0;
const SIDEBAR_STATE_KEY = 'kanban-sidebar-state';
const MIN_SIDEBAR_WIDTH = 120;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 200;

/**
 * Initialize metadata modal event listeners
 */
export function initMetadataModal() {
  modalElement = document.getElementById('metadata-modal');
  overlayElement = document.getElementById('metadata-modal-overlay');

  if (!modalElement || !overlayElement) return;

  // Tab switching
  modalElement.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      // Skip if tab is disabled
      if (tab.classList.contains('disabled')) return;
      switchTab(tab.dataset.tab);
    });
  });

  // Close button
  modalElement
    .querySelector('.modal-close')
    ?.addEventListener('click', hideModal);

  // Minimize button
  modalElement
    .querySelector('.modal-minimize')
    ?.addEventListener('click', minimizeModal);

  // Maximize button
  modalElement
    .querySelector('.modal-maximize')
    ?.addEventListener('click', toggleMaximize);

  // Double-click header to maximize
  const header = modalElement.querySelector('.modal-header');
  header?.addEventListener('dblclick', (e) => {
    if (
      !e.target.closest('.modal-close') &&
      !e.target.closest('.modal-maximize')
    ) {
      toggleMaximize();
    }
  });

  // Window resize handler
  window.addEventListener('resize', handleWindowResize);

  // Click on overlay (outside modal) to minimize
  overlayElement?.addEventListener('click', (e) => {
    if (e.target === overlayElement) {
      minimizeModal();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'Escape' &&
      overlayElement &&
      !overlayElement.classList.contains('hidden')
    ) {
      hideModal();
    }
  });

  // Drag handling (header already defined above for dblclick)
  header?.addEventListener('mousedown', startDrag);

  // Resize handles
  modalElement.querySelectorAll('.resize-handle').forEach((handle) => {
    handle.addEventListener('mousedown', startResize);
  });

  // Global mouse events for drag/resize
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Initialize search
  initSearch();

  // Initialize sidebar
  initSidebar();

  // Initialize QA toggle
  initQaToggle();

  // Initialize taskbar toggle
  initTaskbarToggle();
}

/**
 * Show the modal for a specific task
 */
export function showModal(taskName) {
  if (!modalElement || !overlayElement) return;

  // If this task is already minimized, remove it from minimized list
  if (minimizedModals.has(taskName)) {
    minimizedModals.delete(taskName);
  }

  // If there's currently an open modal for a different task, minimize it first
  if (openModalInfo && openModalInfo.key !== taskName) {
    minimizedModals.set(openModalInfo.key, {
      title: openModalInfo.title,
      mode: openModalInfo.mode,
      columnId: openModalInfo.columnId,
      taskNames: openModalInfo.taskNames,
      taskName: openModalInfo.taskName,
    });
    openModalInfo = null;
  }

  // Reset column mode state (single task mode)
  isColumnMode = false;
  currentColumnId = null;
  columnTasks = [];
  selectedTaskIndex = 0;

  // Hide task tabs for single task mode
  const taskTabsContainer = document.getElementById('modal-task-tabs');
  if (taskTabsContainer) {
    taskTabsContainer.classList.add('hidden');
    taskTabsContainer.innerHTML = '';
  }

  // Hide sidebar in single task mode
  hideSidebar();

  currentTaskName = taskName;

  // Update modal title
  const titleElement = modalElement.querySelector('.modal-title');
  if (titleElement) {
    titleElement.textContent = `Metadata: ${taskName}`;
  }

  // Show overlay and modal
  overlayElement.classList.remove('hidden');

  // Disable body scroll
  document.body.style.overflow = 'hidden';

  // Reset modal position to center
  centerModal();

  // Apply fullscreen state if preference is set
  applyFullscreenState();

  // Clear search
  const searchInput = document.getElementById('metadata-search');
  if (searchInput) {
    searchInput.value = '';
  }
  searchMatches = [];
  currentMatchIndex = -1;
  updateSearchCount();

  // Check which tabs have data available
  checkTabDataAvailability();

  // Load default tab (board)
  switchTab('board');

  // Start auto-refresh polling
  startRefreshPolling();

  // Track open modal for taskbar
  openModalInfo = {
    key: taskName,
    title: taskName,
    mode: 'single',
    columnId: null,
    taskNames: null,
    taskName: taskName,
  };
  renderTaskbarModals();
}

/**
 * Show the modal for a column with multiple tasks
 */
export async function showColumnModal(columnId, taskNames) {
  if (!modalElement || !overlayElement || taskNames.length === 0) return;

  const newModalKey = `column-${columnId}`;

  // If this column is already minimized, remove it from minimized list
  if (minimizedModals.has(newModalKey)) {
    minimizedModals.delete(newModalKey);
  }

  // If there's currently an open modal for a different key, minimize it first
  if (openModalInfo && openModalInfo.key !== newModalKey) {
    minimizedModals.set(openModalInfo.key, {
      title: openModalInfo.title,
      mode: openModalInfo.mode,
      columnId: openModalInfo.columnId,
      taskNames: openModalInfo.taskNames,
      taskName: openModalInfo.taskName,
    });
    openModalInfo = null;
  }

  isColumnMode = true;
  currentColumnId = columnId;
  columnTasks = taskNames;
  selectedTaskIndex = 0;
  currentTaskName = taskNames[0];

  // Update modal title
  const titleElement = modalElement.querySelector('.modal-title');
  const columnNames = {
    all: 'All',
    pending: 'Pending',
    blocked: 'Hold',
    progress: 'In Progress',
    review: 'Code Review',
    completed: 'Completed',
  };
  if (titleElement) {
    titleElement.textContent = `Column: ${columnNames[columnId] || columnId}`;
  }

  // Show overlay and modal
  overlayElement.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Reset modal position
  centerModal();

  // Apply fullscreen state if preference is set
  applyFullscreenState();

  // Clear search
  const searchInput = document.getElementById('metadata-search');
  if (searchInput) searchInput.value = '';
  searchMatches = [];
  currentMatchIndex = -1;
  updateSearchCount();

  // Show sidebar and render task list with loading state
  showSidebar();
  renderSidebarTasks(taskNames, null, true); // true = loading state

  // Hide horizontal task tabs (replaced by sidebar)
  const taskTabsContainer = document.getElementById('modal-task-tabs');
  if (taskTabsContainer) {
    taskTabsContainer.classList.add('hidden');
    taskTabsContainer.innerHTML = '';
  }

  // Fetch progress data immediately (non-blocking for UI)
  try {
    const response = await fetch(`../kanban-progress.json?t=${Date.now()}`);
    if (response.ok) {
      progressDataCache = await response.json();
      // Update sidebar with real status
      updateSidebarTaskStatus(progressDataCache);
    }
  } catch (e) {
    console.warn('Failed to fetch initial progress data:', e);
  }

  // Check tab data availability and load first task
  checkTabDataAvailability();
  switchTab('board');

  // Start auto-refresh
  startRefreshPolling();

  // Track open modal for taskbar (reuse columnNames from above)
  openModalInfo = {
    key: `column-${columnId}`,
    title: `Column: ${columnNames[columnId] || columnId}`,
    mode: 'column',
    columnId: columnId,
    taskNames: [...taskNames],
    taskName: taskNames[0],
  };
  renderTaskbarModals();
}

/**
 * Render task tabs for column mode
 */
function renderTaskTabs() {
  const container = document.getElementById('modal-task-tabs');
  if (!container) return;

  if (!isColumnMode || columnTasks.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = columnTasks
    .map(
      (taskName, index) =>
        `<button class="task-tab ${index === selectedTaskIndex ? 'active' : ''}"
                 data-task-index="${index}"
                 data-task-name="${taskName}"
                 title="${taskName}">${taskName}</button>`
    )
    .join('');

  // Attach click handlers
  container.querySelectorAll('.task-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const index = parseInt(tab.dataset.taskIndex, 10);
      const name = tab.dataset.taskName;
      switchToTask(name, index);
    });
  });
}

/**
 * Switch to a different task in column mode
 */
function switchToTask(taskName, index) {
  if (taskName === currentTaskName && index === selectedTaskIndex) return;

  selectedTaskIndex = index;
  currentTaskName = taskName;

  // Update active tab
  const container = document.getElementById('modal-task-tabs');
  container?.querySelectorAll('.task-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });

  // Update modal title for column mode
  const titleElement = modalElement?.querySelector('.modal-title');
  const columnNames = {
    all: 'All',
    pending: 'Pending',
    blocked: 'Hold',
    progress: 'In Progress',
    review: 'Code Review',
    completed: 'Completed',
  };
  if (titleElement && isColumnMode) {
    titleElement.textContent = `Column: ${columnNames[currentColumnId] || currentColumnId} - ${taskName}`;
  }

  // Clear caches for the new task
  clearCache();

  // Re-check and reload
  checkTabDataAvailability();
  switchTab(currentTabName || 'board');
}

/**
 * Hide the modal
 */
export function hideModal() {
  // Stop auto-refresh polling
  stopRefreshPolling();

  // Reset maximize state (visual only, preference preserved)
  if (isMaximized) {
    modalElement?.classList.remove('maximized');
    isMaximized = false;
    updateMaximizeIcon(false);
  }

  if (overlayElement) {
    overlayElement.classList.add('hidden');
  }

  // Restore body scroll
  document.body.style.overflow = '';

  // Reset column mode state
  isColumnMode = false;
  currentColumnId = null;
  columnTasks = [];
  selectedTaskIndex = 0;

  // Hide task tabs
  const taskTabsContainer = document.getElementById('modal-task-tabs');
  if (taskTabsContainer) {
    taskTabsContainer.classList.add('hidden');
    taskTabsContainer.innerHTML = '';
  }

  // Hide sidebar
  hideSidebar();

  currentTaskName = null;
  currentTabData = null;
  currentTabName = null;

  // Clear open modal tracking
  openModalInfo = null;
  renderTaskbarModals();
}

/**
 * Clear cached data (call on board refresh)
 */
export function clearCache() {
  boardDataCache = null;
  progressDataCache = null;
  logDataCache.clear();
  outputDataCache.clear();
  promptDataCache.clear();
}

/**
 * Get the file suffix based on QA mode
 */
function getWorkerFileSuffix() {
  return isQaMode ? '-test-creation' : '';
}

/**
 * Check which tabs have data available and update their disabled state
 */
async function checkTabDataAvailability() {
  if (!modalElement || !currentTaskName) return;

  const tabs = {
    board: modalElement.querySelector('[data-tab="board"]'),
    progress: modalElement.querySelector('[data-tab="progress"]'),
    prompt: modalElement.querySelector('[data-tab="prompt"]'),
    log: modalElement.querySelector('[data-tab="log"]'),
    output: modalElement.querySelector('[data-tab="output"]'),
  };

  // Check each data source
  const availability = {
    board: false,
    progress: false,
    prompt: false,
    log: false,
    output: false,
  };

  const suffix = getWorkerFileSuffix();

  // Check board data
  try {
    const boardData = await fetchBoardData();
    availability.board = boardData !== null;
  } catch {
    availability.board = false;
  }

  // Check progress data
  try {
    const progressData = await fetchProgressData();
    availability.progress = progressData !== null;
  } catch {
    availability.progress = false;
  }

  // Check prompt data (worker-prompt)
  try {
    const response = await fetch(
      `../worker-logs/${currentTaskName}${suffix}-prompt.txt?t=${Date.now()}`
    );
    availability.prompt = response.ok;
  } catch {
    availability.prompt = false;
  }

  // Check log data (worker-raw)
  try {
    const response = await fetch(
      `../worker-logs/${currentTaskName}${suffix}.json?t=${Date.now()}`
    );
    availability.log = response.ok;
  } catch {
    availability.log = false;
  }

  // Check output data (worker-output)
  try {
    const response = await fetch(
      `../worker-logs/${currentTaskName}${suffix}-output.json?t=${Date.now()}`
    );
    availability.output = response.ok;
  } catch {
    availability.output = false;
  }

  // Update tab disabled states
  Object.entries(tabs).forEach(([tabName, tabElement]) => {
    if (tabElement) {
      if (availability[tabName]) {
        tabElement.classList.remove('disabled');
      } else {
        tabElement.classList.add('disabled');
      }
    }
  });

  return availability;
}

/**
 * Save modal size to localStorage
 */
function saveModalSize() {
  if (!modalElement) return;

  const size = {
    width: modalElement.offsetWidth,
    height: modalElement.offsetHeight,
  };

  try {
    localStorage.setItem(MODAL_SIZE_KEY, JSON.stringify(size));
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Load modal size from localStorage
 */
function loadModalSize() {
  try {
    const stored = localStorage.getItem(MODAL_SIZE_KEY);
    if (stored) {
      const size = JSON.parse(stored);
      return {
        width: Math.max(MIN_WIDTH, size.width || DEFAULT_WIDTH),
        height: Math.max(MIN_HEIGHT, size.height || DEFAULT_HEIGHT),
      };
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

/**
 * Load fullscreen state from localStorage
 */
function loadFullscreenState() {
  try {
    return localStorage.getItem(FULLSCREEN_STATE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Save fullscreen state to localStorage
 */
function saveFullscreenState(isFullscreen) {
  try {
    localStorage.setItem(FULLSCREEN_STATE_KEY, isFullscreen ? 'true' : 'false');
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Apply fullscreen state to modal on open
 */
function applyFullscreenState() {
  const shouldBeFullscreen = loadFullscreenState();

  if (shouldBeFullscreen && !isMaximized) {
    // Save current state for restore
    const rect = modalElement.getBoundingClientRect();
    preMaximizeState = {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };

    modalElement.classList.add('maximized');
    isMaximized = true;
    updateMaximizeIcon(true);
  } else if (!shouldBeFullscreen && isMaximized) {
    modalElement.classList.remove('maximized');
    isMaximized = false;
    updateMaximizeIcon(false);
  }
}

/**
 * Center the modal on screen
 */
function centerModal() {
  if (!modalElement) return;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const size = loadModalSize();

  modalElement.style.width = `${size.width}px`;
  modalElement.style.height = `${size.height}px`;
  modalElement.style.left = `${(viewportWidth - size.width) / 2}px`;
  modalElement.style.top = `${(viewportHeight - size.height) / 2}px`;
}

/**
 * Switch between tabs
 */
async function switchTab(tabName) {
  if (!modalElement) return;

  currentTabName = tabName;

  // Update tab active state
  modalElement.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Show loading state
  const contentElement = modalElement.querySelector('.modal-content');
  if (contentElement) {
    contentElement.innerHTML = '<div class="modal-loading">Loading...</div>';
  }

  // Clear search when switching tabs
  const searchInput = document.getElementById('metadata-search');
  if (searchInput) {
    searchInput.value = '';
  }
  searchMatches = [];
  currentMatchIndex = -1;
  updateSearchCount();

  // Fetch and display data based on tab
  const data = await fetchTabData(tabName);
  currentTabData = data;

  // Display the data
  renderTabContent(data);
}

/**
 * Fetch data for a specific tab
 */
async function fetchTabData(tabName) {
  try {
    switch (tabName) {
      case 'progress':
        return await fetchProgressData();
      case 'board':
        return await fetchBoardData();
      case 'prompt':
        return await fetchPromptData();
      case 'log':
        return await fetchLogData();
      case 'output':
        return await fetchOutputData();
      default:
        return null;
    }
  } catch (e) {
    return { __error: e.message };
  }
}

/**
 * Render tab content (tree view or error)
 */
function renderTabContent(data) {
  const contentElement = modalElement?.querySelector('.modal-content');
  if (!contentElement) return;

  // Reset search state
  searchMatches = [];
  currentMatchIndex = -1;
  if (searchAbortController) {
    searchAbortController.abort();
    searchAbortController = null;
  }

  if (data === null) {
    contentElement.innerHTML =
      '<div class="modal-error">No data found for this task</div>';
  } else if (data?.__error) {
    contentElement.innerHTML = `<div class="modal-error">${escapeHtml(data.__error)}</div>`;
  } else if (currentTabName === 'prompt' && typeof data === 'string') {
    // Render prompt as plain text
    contentElement.innerHTML = '';
    const pre = document.createElement('pre');
    pre.className = 'prompt-text';
    pre.textContent = data;
    contentElement.appendChild(pre);
  } else {
    contentElement.innerHTML = '';

    // Add search bar
    const searchBar = createSearchBar();
    contentElement.appendChild(searchBar);

    // Add JSON tree
    const treeContainer = createJsonTree(data);
    contentElement.appendChild(treeContainer);
    attachTreeEventListeners(treeContainer);

    // Bind search listeners
    bindSearchListeners(contentElement);
  }
}

/**
 * Fetch kanban-progress.json and extract task entry
 */
async function fetchProgressData() {
  if (!progressDataCache) {
    const response = await fetch(`../kanban-progress.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to load kanban-progress.json');
    progressDataCache = await response.json();
  }

  // Find task in progress data (data is keyed by task name)
  const taskEntry = progressDataCache[currentTaskName];
  return taskEntry || null;
}

/**
 * Fetch kanban-board.json and extract task entry
 */
async function fetchBoardData() {
  if (!boardDataCache) {
    const response = await fetch(`../kanban-board.json?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to load kanban-board.json');
    boardDataCache = await response.json();
  }

  // Find task in board data
  const taskEntry = boardDataCache.tasks?.find(
    (t) => t.name === currentTaskName
  );
  return taskEntry || null;
}

/**
 * Fetch worker-logs/{taskName}.json (supports both JSON and JSONL formats)
 */
async function fetchLogData() {
  if (!currentTaskName) return null;

  const suffix = getWorkerFileSuffix();
  const cacheKey = `${currentTaskName}${suffix}`;

  if (!logDataCache.has(cacheKey)) {
    try {
      const response = await fetch(
        `../worker-logs/${currentTaskName}${suffix}.json?t=${Date.now()}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Log file not found: worker-logs/${currentTaskName}${suffix}.json`
          );
        }
        throw new Error(`Failed to load log file (${response.status})`);
      }

      // Read as text first to handle JSONL format
      let text = await response.text();

      // Strip UTF-8 BOM if present (common in Windows-generated files)
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }

      let data;

      try {
        // First try parsing as standard JSON (array or object)
        data = JSON.parse(text);
      } catch (jsonError) {
        // Fall back to JSONL: split by newlines and parse each line
        const entries = [];
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            entries.push(JSON.parse(trimmed));
          } catch (lineError) {
            // Skip unparseable lines
          }
        }
        data = entries;
      }

      logDataCache.set(cacheKey, data);
    } catch (e) {
      if (e.message.includes('not found') || e.message.includes('404')) {
        throw e;
      }
      throw new Error(
        `Log file not found: worker-logs/${currentTaskName}${suffix}.json`
      );
    }
  }

  return logDataCache.get(cacheKey);
}

/**
 * Fetch worker-logs/{taskName}-output.json
 */
async function fetchOutputData() {
  if (!currentTaskName) return null;

  const suffix = getWorkerFileSuffix();
  const cacheKey = `${currentTaskName}${suffix}-output`;
  if (!outputDataCache.has(cacheKey)) {
    try {
      const response = await fetch(
        `../worker-logs/${currentTaskName}${suffix}-output.json?t=${Date.now()}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Output file not found: worker-logs/${currentTaskName}${suffix}-output.json`
          );
        }
        throw new Error(`Failed to load output file (${response.status})`);
      }
      outputDataCache.set(cacheKey, await response.json());
    } catch (e) {
      if (e.message.includes('not found') || e.message.includes('404')) {
        throw e;
      }
      throw new Error(
        `Output file not found: worker-logs/${currentTaskName}${suffix}-output.json`
      );
    }
  }

  return outputDataCache.get(cacheKey);
}

/**
 * Fetch worker-logs/{taskName}-prompt.txt
 */
async function fetchPromptData() {
  if (!currentTaskName) return null;

  const suffix = getWorkerFileSuffix();
  const cacheKey = `${currentTaskName}${suffix}-prompt`;

  if (!promptDataCache.has(cacheKey)) {
    try {
      const response = await fetch(
        `../worker-logs/${currentTaskName}${suffix}-prompt.txt?t=${Date.now()}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Prompt file not found: worker-logs/${currentTaskName}${suffix}-prompt.txt`
          );
        }
        throw new Error(`Failed to load prompt file (${response.status})`);
      }
      promptDataCache.set(cacheKey, await response.text());
    } catch (e) {
      if (e.message.includes('not found') || e.message.includes('404')) {
        throw e;
      }
      throw new Error(
        `Prompt file not found: worker-logs/${currentTaskName}${suffix}-prompt.txt`
      );
    }
  }

  return promptDataCache.get(cacheKey);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== JSON Tree Rendering =====

/**
 * Creates a collapsible JSON tree from data
 */
function createJsonTree(data) {
  const container = document.createElement('div');
  container.className = 'json-tree';
  const rootNode = buildNode(data, null, 'root', 0, true);
  container.appendChild(rootNode);
  return container;
}

/**
 * Recursively builds DOM nodes for JSON values
 */
function buildNode(value, key, path, depth, isLast) {
  if (value === null) {
    return createPrimitiveNode(value, key, path, depth, isLast, 'null');
  }
  if (Array.isArray(value)) {
    return createArrayNode(value, key, path, depth, isLast);
  }
  if (typeof value === 'object') {
    return createObjectNode(value, key, path, depth, isLast);
  }
  return createPrimitiveNode(value, key, path, depth, isLast, typeof value);
}

/**
 * Creates a node for primitive values (string, number, boolean, null)
 */
function createPrimitiveNode(value, key, path, depth, isLast, type) {
  const node = document.createElement('div');
  node.className = 'json-node json-primitive';
  node.dataset.path = path;

  let html = '';

  if (key !== null) {
    const keyStr = escapeHtml(JSON.stringify(key));
    html += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
    html += '<span class="json-colon">: </span>';
  }

  let valueStr;
  let valueClass;
  let searchableValue;

  if (type === 'null') {
    valueStr = 'null';
    valueClass = 'json-null';
    searchableValue = 'null';
  } else if (type === 'string') {
    valueStr = escapeHtml(JSON.stringify(value));
    valueClass = 'json-string';
    searchableValue = escapeHtml(value);
  } else if (type === 'number') {
    valueStr = String(value);
    valueClass = 'json-number';
    searchableValue = String(value);
  } else if (type === 'boolean') {
    valueStr = String(value);
    valueClass = 'json-boolean';
    searchableValue = String(value);
  }

  html += `<span class="${valueClass}" data-searchable="${searchableValue}">${valueStr}</span>`;

  if (!isLast) {
    html += '<span class="json-comma">,</span>';
  }

  node.innerHTML = html;
  return node;
}

/**
 * Creates a collapsible node for objects
 */
function createObjectNode(obj, key, path, depth, isLast) {
  const node = document.createElement('div');
  node.className = 'json-node json-object';
  node.dataset.path = path;

  const entries = Object.entries(obj);
  const count = entries.length;

  let headerHtml = '<span class="json-toggle">▼</span>';

  if (key !== null) {
    const keyStr = escapeHtml(JSON.stringify(key));
    headerHtml += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
    headerHtml += '<span class="json-colon">: </span>';
  }

  headerHtml += '<span class="json-brace">{</span>';
  headerHtml += `<span class="json-summary">${count} ${count === 1 ? 'item' : 'items'}</span>`;

  node.innerHTML = headerHtml;

  // Create children container
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'json-children';

  entries.forEach(([childKey, childValue], index) => {
    const childPath = `${path}.${childKey}`;
    const childIsLast = index === entries.length - 1;
    const childNode = buildNode(
      childValue,
      childKey,
      childPath,
      depth + 1,
      childIsLast
    );
    childrenContainer.appendChild(childNode);
  });

  node.appendChild(childrenContainer);

  // Closing brace
  const closeBrace = document.createElement('span');
  closeBrace.className = 'json-brace json-close';
  closeBrace.textContent = '}';
  node.appendChild(closeBrace);

  if (!isLast) {
    const comma = document.createElement('span');
    comma.className = 'json-comma';
    comma.textContent = ',';
    node.appendChild(comma);
  }

  return node;
}

/**
 * Creates a collapsible node for arrays
 */
function createArrayNode(arr, key, path, depth, isLast) {
  const node = document.createElement('div');
  node.className = 'json-node json-array';
  node.dataset.path = path;

  const count = arr.length;

  let headerHtml = '<span class="json-toggle">▼</span>';

  if (key !== null) {
    const keyStr = escapeHtml(JSON.stringify(key));
    headerHtml += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
    headerHtml += '<span class="json-colon">: </span>';
  }

  headerHtml += '<span class="json-bracket">[</span>';
  headerHtml += `<span class="json-summary">${count} ${count === 1 ? 'item' : 'items'}</span>`;

  node.innerHTML = headerHtml;

  // Create children container
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'json-children';

  arr.forEach((childValue, index) => {
    const childPath = `${path}[${index}]`;
    const childIsLast = index === arr.length - 1;
    const childNode = buildNode(
      childValue,
      index,
      childPath,
      depth + 1,
      childIsLast
    );
    childrenContainer.appendChild(childNode);
  });

  node.appendChild(childrenContainer);

  // Closing bracket
  const closeBracket = document.createElement('span');
  closeBracket.className = 'json-bracket json-close';
  closeBracket.textContent = ']';
  node.appendChild(closeBracket);

  if (!isLast) {
    const comma = document.createElement('span');
    comma.className = 'json-comma';
    comma.textContent = ',';
    node.appendChild(comma);
  }

  return node;
}

/**
 * Toggle collapsed state of a node
 */
function toggleNode(node) {
  node.classList.toggle('collapsed');
}

/**
 * Set collapsed state of a node
 */
function setNodeCollapsed(node, collapsed) {
  if (collapsed) {
    node.classList.add('collapsed');
  } else {
    node.classList.remove('collapsed');
  }
}

/**
 * Attach event listeners for tree interactions
 */
function attachTreeEventListeners(container) {
  // Click on toggle icon
  container.addEventListener('click', (e) => {
    const toggle = e.target.closest('.json-toggle');
    if (toggle) {
      const node = toggle.closest('.json-node');
      if (node) {
        toggleNode(node);
      }
    }
  });

  // Double-click on key to toggle
  container.addEventListener('dblclick', (e) => {
    const key = e.target.closest('.json-key');
    if (key) {
      const node = key.closest('.json-node');
      if (
        node &&
        (node.classList.contains('json-object') ||
          node.classList.contains('json-array'))
      ) {
        toggleNode(node);
      }
    }
  });
}

// ===== Search Functionality =====

/**
 * Create search bar HTML inside the json-tree container
 */
function createSearchBar() {
  const searchBar = document.createElement('div');
  searchBar.className = 'json-viewer-search';
  searchBar.innerHTML = `
        <input type="text" id="metadata-search" placeholder="Search JSON..." />
        <div class="search-nav">
            <button id="search-prev" title="Previous (Shift+Enter)" disabled>&#9650;</button>
            <span class="search-count" id="metadata-search-count"></span>
            <button id="search-next" title="Next (Enter)" disabled>&#9660;</button>
        </div>
        <span class="search-status" id="metadata-search-status"></span>
    `;
  return searchBar;
}

/**
 * Initialize search input listeners
 */
function initSearch() {
  // Search will be initialized after content renders
}

/**
 * Bind search event listeners after content is rendered
 */
function bindSearchListeners(container) {
  const searchInput = container.querySelector('#metadata-search');
  const prevBtn = container.querySelector('#search-prev');
  const nextBtn = container.querySelector('#search-next');

  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const query = e.target.value.trim();
      const jsonTree = container.querySelector('.json-tree');
      if (jsonTree) {
        searchJsonAsync(jsonTree, query);
      }
    }, 300);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        navigateToPrevMatch();
      } else {
        navigateToNextMatch();
      }
    }
  });

  prevBtn?.addEventListener('click', navigateToPrevMatch);
  nextBtn?.addEventListener('click', navigateToNextMatch);
}

/**
 * Async search with batched processing
 */
async function searchJsonAsync(container, query) {
  // Cancel previous search
  if (searchAbortController) {
    searchAbortController.abort();
  }

  // Clear previous highlights
  clearSearchHighlights(container);
  searchMatches = [];
  currentMatchIndex = -1;

  if (!query) {
    updateSearchUI(null, 0);
    return;
  }

  searchAbortController = new AbortController();
  const signal = searchAbortController.signal;

  // Show searching status
  updateSearchStatus('Searching...');

  const searchables = container.querySelectorAll('[data-searchable]');
  const searchLower = query.toLowerCase();
  const BATCH_SIZE = 100;

  try {
    for (let i = 0; i < searchables.length; i += BATCH_SIZE) {
      if (signal.aborted) return;

      const batch = Array.from(searchables).slice(i, i + BATCH_SIZE);

      batch.forEach((el) => {
        const text = el.dataset.searchable.toLowerCase();
        if (text.includes(searchLower)) {
          highlightMatches(el, query);
          searchMatches.push(el);
        }
      });

      // Yield to browser
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (signal.aborted) return;

    // Expand ancestors of all matches
    expandSearchMatches(container, searchMatches);

    // Update UI
    updateSearchUI(searchMatches.length, searchMatches.length);

    // Navigate to first match
    if (searchMatches.length > 0) {
      navigateToMatch(0);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Search error:', e);
    }
  }
}

/**
 * Highlight matches in an element
 */
function highlightMatches(el, query) {
  const originalText = el.textContent;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const newHtml = originalText.replace(
    regex,
    '<span class="json-match">$1</span>'
  );
  el.innerHTML = newHtml;
}

/**
 * Navigate to a specific match
 */
function navigateToMatch(index) {
  if (searchMatches.length === 0) return;

  // Remove current class from previous match
  const prevCurrent = document.querySelector('.json-match.current');
  if (prevCurrent) {
    prevCurrent.classList.remove('current');
  }

  // Wrap index
  if (index < 0) index = searchMatches.length - 1;
  if (index >= searchMatches.length) index = 0;

  currentMatchIndex = index;

  // Find the match span within the element and mark as current
  const matchEl = searchMatches[index];
  const matchSpan = matchEl.querySelector('.json-match');
  if (matchSpan) {
    matchSpan.classList.add('current');
    matchSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  updateSearchCount();
}

function navigateToNextMatch() {
  navigateToMatch(currentMatchIndex + 1);
}

function navigateToPrevMatch() {
  navigateToMatch(currentMatchIndex - 1);
}

/**
 * Update search UI elements
 */
function updateSearchUI(count, total) {
  updateSearchCount();
  updateSearchStatus('');

  const prevBtn = document.getElementById('search-prev');
  const nextBtn = document.getElementById('search-next');

  if (prevBtn) prevBtn.disabled = !searchMatches.length;
  if (nextBtn) nextBtn.disabled = !searchMatches.length;
}

function updateSearchCount() {
  const countEl = document.getElementById('metadata-search-count');
  if (!countEl) return;

  if (searchMatches.length === 0) {
    const searchInput = document.getElementById('metadata-search');
    if (searchInput && searchInput.value.trim()) {
      countEl.textContent = '0/0';
    } else {
      countEl.textContent = '';
    }
  } else {
    countEl.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`;
  }
}

function updateSearchStatus(status) {
  const statusEl = document.getElementById('metadata-search-status');
  if (statusEl) {
    statusEl.textContent = status;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clear all search highlights
 */
function clearSearchHighlights(container) {
  const highlights = container.querySelectorAll('.json-match');
  highlights.forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      parent.innerHTML = parent.textContent;
    }
  });
}

/**
 * Expand collapsed ancestors for all matches
 */
function expandSearchMatches(container, matches) {
  matches.forEach((match) => {
    let parent = match.closest('.json-node');
    while (parent) {
      // Expand if it's a collapsible node
      if (
        parent.classList.contains('json-object') ||
        parent.classList.contains('json-array')
      ) {
        setNodeCollapsed(parent, false);
      }
      parent = parent.parentElement?.closest('.json-node');
    }
  });
}

// ===== Auto-Refresh Polling =====

/**
 * Start auto-refresh polling (every 1 second)
 */
function startRefreshPolling() {
  stopRefreshPolling();

  refreshInterval = setInterval(async () => {
    await refreshCurrentTab();
  }, 1000);
}

/**
 * Stop auto-refresh polling
 */
function stopRefreshPolling() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

/**
 * Refresh the current tab's content if data changed
 */
async function refreshCurrentTab() {
  if (!currentTabName || !modalElement) return;

  // Clear cache before fetching to get fresh data
  clearCache();

  // Re-check tab availability (data might have appeared)
  checkTabDataAvailability();

  const newData = await fetchTabData(currentTabName);

  // Only re-render if data changed
  const newDataStr = JSON.stringify(newData);
  const oldDataStr = JSON.stringify(currentTabData);

  if (newDataStr !== oldDataStr) {
    currentTabData = newData;
    renderTabContent(newData);

    // Preserve search query if any
    const searchInput = document.getElementById('metadata-search');
    if (searchInput && searchInput.value.trim()) {
      const container = document.querySelector('.json-tree');
      if (container) {
        searchJsonAsync(container, searchInput.value.trim());
      }
    }
  }

  // Update sidebar task status if in column mode
  if (isColumnMode && progressDataCache) {
    updateSidebarTaskStatus(progressDataCache);
  }
}

/**
 * Start dragging the modal
 */
function startDrag(e) {
  // Don't drag if maximized
  if (isMaximized) return;

  // Don't drag if clicking close button or maximize button
  if (e.target.closest('.modal-close') || e.target.closest('.modal-maximize'))
    return;

  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  const rect = modalElement.getBoundingClientRect();
  modalStartX = rect.left;
  modalStartY = rect.top;

  e.preventDefault();
}

/**
 * Start resizing the modal
 */
function startResize(e) {
  // Don't resize if maximized
  if (isMaximized) return;

  isResizing = true;

  // Get resize direction from handle class
  const handle = e.target;
  const classes = handle.className.split(' ');
  resizeDirection =
    classes
      .find((c) => c.startsWith('resize-') && c !== 'resize-handle')
      ?.replace('resize-', '') || '';

  resizeStartX = e.clientX;
  resizeStartY = e.clientY;

  const rect = modalElement.getBoundingClientRect();
  modalStartWidth = rect.width;
  modalStartHeight = rect.height;
  modalStartLeft = rect.left;
  modalStartTop = rect.top;

  e.preventDefault();
}

/**
 * Clamp modal position to keep modal completely within viewport
 */
function clampPosition(left, top, width, height) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Modal must stay completely within viewport
  const clampedLeft = Math.max(0, Math.min(viewportWidth - width, left));
  const clampedTop = Math.max(0, Math.min(viewportHeight - height, top));

  return { left: clampedLeft, top: clampedTop };
}

/**
 * Handle mouse move for drag/resize
 */
function handleMouseMove(e) {
  if (isDragging) {
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    const newLeft = modalStartX + deltaX;
    const newTop = modalStartY + deltaY;
    const width = modalElement.offsetWidth;
    const height = modalElement.offsetHeight;

    const clamped = clampPosition(newLeft, newTop, width, height);
    modalElement.style.left = `${clamped.left}px`;
    modalElement.style.top = `${clamped.top}px`;
  }

  if (isSidebarResizing) {
    handleSidebarResize(e);
  }

  if (isResizing) {
    const deltaX = e.clientX - resizeStartX;
    const deltaY = e.clientY - resizeStartY;

    let newWidth = modalStartWidth;
    let newHeight = modalStartHeight;
    let newLeft = modalStartLeft;
    let newTop = modalStartTop;

    // Handle horizontal resizing
    if (resizeDirection.includes('e')) {
      newWidth = Math.max(MIN_WIDTH, modalStartWidth + deltaX);
    }
    if (resizeDirection.includes('w')) {
      const widthDelta = Math.min(deltaX, modalStartWidth - MIN_WIDTH);
      newWidth = modalStartWidth - widthDelta;
      newLeft = modalStartLeft + widthDelta;
    }

    // Handle vertical resizing
    if (resizeDirection.includes('s')) {
      newHeight = Math.max(MIN_HEIGHT, modalStartHeight + deltaY);
    }
    if (resizeDirection.includes('n')) {
      const heightDelta = Math.min(deltaY, modalStartHeight - MIN_HEIGHT);
      newHeight = modalStartHeight - heightDelta;
      newTop = modalStartTop + heightDelta;
    }

    // Apply viewport constraints to resized position
    const clamped = clampPosition(newLeft, newTop, newWidth, newHeight);

    modalElement.style.width = `${newWidth}px`;
    modalElement.style.height = `${newHeight}px`;
    modalElement.style.left = `${clamped.left}px`;
    modalElement.style.top = `${clamped.top}px`;
  }
}

/**
 * Handle mouse up to end drag/resize
 */
function handleMouseUp() {
  if (isResizing) {
    saveModalSize();
  }
  if (isSidebarResizing) {
    endSidebarResize();
  }
  isDragging = false;
  isResizing = false;
}

/**
 * Toggle maximize/restore state
 */
function toggleMaximize() {
  if (!modalElement) return;

  if (isMaximized) {
    // Restore
    modalElement.classList.remove('maximized');
    modalElement.style.width = `${preMaximizeState.width}px`;
    modalElement.style.height = `${preMaximizeState.height}px`;
    modalElement.style.left = `${preMaximizeState.left}px`;
    modalElement.style.top = `${preMaximizeState.top}px`;

    // Update icon to maximize
    updateMaximizeIcon(false);
  } else {
    // Save current state
    const rect = modalElement.getBoundingClientRect();
    preMaximizeState = {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };

    // Maximize
    modalElement.classList.add('maximized');

    // Update icon to restore
    updateMaximizeIcon(true);
  }

  isMaximized = !isMaximized;
  saveFullscreenState(isMaximized);
}

/**
 * Update maximize button icon
 */
function updateMaximizeIcon(isMaximizedState) {
  const btn = modalElement?.querySelector('.modal-maximize');
  if (!btn) return;

  if (isMaximizedState) {
    // Show restore icon (two overlapping rectangles)
    btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <rect x="5" y="8" width="11" height="11" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M8 8V5a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1h-3" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
        `;
    btn.title = 'Restore';
  } else {
    // Show maximize icon
    btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
        `;
    btn.title = 'Maximize';
  }
}

/**
 * Handle window resize
 */
function handleWindowResize() {
  if (!modalElement || overlayElement?.classList.contains('hidden')) return;

  if (isMaximized) {
    // Already maximized, CSS handles it
    return;
  }

  // Re-clamp position if modal is outside viewport
  const rect = modalElement.getBoundingClientRect();
  const clamped = clampPosition(rect.left, rect.top, rect.width, rect.height);

  if (clamped.left !== rect.left || clamped.top !== rect.top) {
    modalElement.style.left = `${clamped.left}px`;
    modalElement.style.top = `${clamped.top}px`;
  }
}

// ===== QA Toggle Functions =====

/**
 * Initialize QA toggle button
 */
function initQaToggle() {
  const toggle = document.getElementById('qa-toggle');
  toggle?.addEventListener('click', () => {
    isQaMode = !isQaMode;
    toggle.classList.toggle('active', isQaMode);

    // Clear worker-related caches
    logDataCache.clear();
    outputDataCache.clear();
    promptDataCache.clear();

    // Re-check tab availability and reload current tab
    checkTabDataAvailability();
    if (['log', 'output', 'prompt'].includes(currentTabName)) {
      switchTab(currentTabName);
    }
  });
}

// ===== Taskbar Toggle Functions =====

/**
 * Initialize taskbar toggle button
 */
function initTaskbarToggle() {
  // Load saved state
  loadTaskbarState();

  const toggleBtn = document.getElementById('taskbar-toggle');
  if (!toggleBtn) return;

  // Apply initial state to toggle button
  applyTaskbarToggleState();

  // Click handler
  toggleBtn.addEventListener('click', () => {
    taskbarCollapsed = !taskbarCollapsed;
    saveTaskbarState();
    applyTaskbarToggleState();
    renderTaskbarModals();
  });
}

/**
 * Load taskbar collapsed state from localStorage
 */
function loadTaskbarState() {
  try {
    taskbarCollapsed = localStorage.getItem(TASKBAR_STATE_KEY) === 'true';
  } catch (e) {
    taskbarCollapsed = false;
  }
}

/**
 * Save taskbar collapsed state to localStorage
 */
function saveTaskbarState() {
  try {
    localStorage.setItem(TASKBAR_STATE_KEY, taskbarCollapsed ? 'true' : 'false');
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Apply taskbar toggle state to the button
 */
function applyTaskbarToggleState() {
  const toggleBtn = document.getElementById('taskbar-toggle');
  if (!toggleBtn) return;

  // Update button class for arrow direction
  toggleBtn.classList.toggle('collapsed', taskbarCollapsed);
  toggleBtn.classList.toggle('expanded', !taskbarCollapsed);
}

// ===== Minimize Functions =====

/**
 * Minimize the current modal to the status bar
 */
function minimizeModal() {
  if (!currentTaskName || !modalElement || !overlayElement) return;

  // Column names mapping
  const columnNames = {
    all: 'All',
    pending: 'Pending',
    blocked: 'Hold',
    progress: 'In Progress',
    review: 'Code Review',
    completed: 'Completed',
  };

  // Generate a unique key for this modal instance
  const modalKey = isColumnMode ? `column-${currentColumnId}` : currentTaskName;

  // Store modal state
  minimizedModals.set(modalKey, {
    title: isColumnMode ? `Column: ${columnNames[currentColumnId] || currentColumnId}` : currentTaskName,
    mode: isColumnMode ? 'column' : 'single',
    columnId: isColumnMode ? currentColumnId : null,
    taskNames: isColumnMode ? [...columnTasks] : null,
    taskName: currentTaskName,
  });

  // Stop auto-refresh polling for minimized modal
  stopRefreshPolling();

  // Hide modal
  overlayElement.classList.add('hidden');
  document.body.style.overflow = '';

  // Reset maximize state visually (will be restored via applyFullscreenState on reopen)
  if (isMaximized) {
    modalElement.classList.remove('maximized');
    isMaximized = false;
    updateMaximizeIcon(false);
  }

  // Clear open modal tracking (it's now minimized)
  openModalInfo = null;

  // Update status bar
  renderTaskbarModals();
}

/**
 * Restore a minimized modal from the status bar
 */
function restoreModal(modalKey) {
  const state = minimizedModals.get(modalKey);
  if (!state) return;

  // If there's currently an open modal, minimize it first (add to minimized list)
  if (openModalInfo && openModalInfo.key !== modalKey) {
    minimizedModals.set(openModalInfo.key, {
      title: openModalInfo.title,
      mode: openModalInfo.mode,
      columnId: openModalInfo.columnId,
      taskNames: openModalInfo.taskNames,
      taskName: openModalInfo.taskName,
    });
    openModalInfo = null;
  }

  minimizedModals.delete(modalKey);

  // Re-show modal with saved state
  if (state.mode === 'column') {
    showColumnModal(state.columnId, state.taskNames);
  } else {
    showModal(state.taskName);
  }
}

/**
 * Render taskbar modals (both open and minimized) in the status bar
 */
function renderTaskbarModals() {
  const taskbarModals = document.getElementById('taskbar-modals');
  const divider = document.getElementById('status-divider');
  const toggleBtn = document.getElementById('taskbar-toggle');

  if (!taskbarModals) return;

  // Clear container
  taskbarModals.innerHTML = '';

  const hasOpenModal = openModalInfo !== null;
  const hasMinimizedModals = minimizedModals.size > 0;
  const hasAnyModals = hasOpenModal || hasMinimizedModals;

  // Show/hide divider based on whether there are any modals (same as toggle)
  if (divider) {
    divider.style.display = hasAnyModals ? 'block' : 'none';
  }

  // Show/hide toggle button based on whether there are any modals
  if (toggleBtn) {
    toggleBtn.style.display = hasAnyModals ? 'flex' : 'none';
  }

  // Hide taskbar modals container when no modals exist (removes gap space)
  // Use 'hidden' class instead of inline style to not interfere with collapsed state
  taskbarModals.classList.toggle('hidden', !hasAnyModals);

  // Apply collapsed state to taskbar modals container
  taskbarModals.classList.toggle('collapsed', taskbarCollapsed && hasAnyModals);

  // Collect all modals with their keys for consistent ordering
  const allModals = [];

  // Add open modal
  if (openModalInfo) {
    allModals.push({ key: openModalInfo.key, state: openModalInfo, isOpen: true });
  }

  // Add minimized modals
  minimizedModals.forEach((state, key) => {
    allModals.push({ key, state, isOpen: false });
  });

  // Sort by key for consistent ordering
  allModals.sort((a, b) => a.key.localeCompare(b.key));

  // Render all modals in order
  allModals.forEach(({ key, state, isOpen }) => {
    const item = document.createElement('button');
    item.className = isOpen ? 'open-modal-item' : 'minimized-modal-item';

    // Get display name (remove "Column: " prefix since icon will indicate type)
    const displayName = state.mode === 'column'
      ? state.title.replace(/^Column:\s*/, '')
      : state.title;
    item.title = isOpen ? `${state.title} (Open)` : state.title;

    // Icon based on modal type
    const iconSpan = document.createElement('span');
    iconSpan.className = isOpen ? 'open-modal-icon' : 'minimized-modal-icon';
    if (state.mode === 'column') {
      // Kanban icon for column modals
      iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
        <rect x="3" y="3" width="5" height="18" rx="1" />
        <rect x="10" y="3" width="5" height="12" rx="1" />
        <rect x="17" y="3" width="4" height="15" rx="1" />
      </svg>`;
    } else {
      // File icon for single task modals
      iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>`;
    }

    // Separator after icon
    const iconSeparator = document.createElement('span');
    iconSeparator.className = isOpen ? 'open-modal-separator' : 'minimized-modal-separator';

    // Name span
    const nameSpan = document.createElement('span');
    nameSpan.className = isOpen ? 'open-modal-name' : 'minimized-modal-name';
    nameSpan.textContent = displayName;

    // Separator before close
    const separator = document.createElement('span');
    separator.className = isOpen ? 'open-modal-separator' : 'minimized-modal-separator';

    // Close/Delete button
    const closeBtn = document.createElement('span');
    closeBtn.className = isOpen ? 'open-modal-close' : 'minimized-modal-delete';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOpen) {
        hideModal();
      } else {
        minimizedModals.delete(key);
        renderTaskbarModals();
      }
    });

    item.appendChild(iconSpan);
    item.appendChild(iconSeparator);
    item.appendChild(nameSpan);
    item.appendChild(separator);
    item.appendChild(closeBtn);

    // Click handler
    if (isOpen) {
      // Clicking an open modal minimizes it
      item.addEventListener('click', () => minimizeModal());
    } else {
      item.addEventListener('click', () => restoreModal(key));
    }

    taskbarModals.appendChild(item);
  });
}

/**
 * Truncate task name for display in status bar
 */
function truncateTaskName(name, maxLength) {
  return name.length > maxLength ? name.slice(0, maxLength - 3) + '...' : name;
}

// ===== Sidebar Functions =====

/**
 * Initialize sidebar functionality
 */
function initSidebar() {
  loadSidebarState();
  setupSidebarCollapse();
  setupSidebarResize();
}

/**
 * Load sidebar state from localStorage
 */
function loadSidebarState() {
  try {
    const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      sidebarCollapsed = state.collapsed || false;
      sidebarWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, state.width || DEFAULT_SIDEBAR_WIDTH)
      );
    }
  } catch (e) {
    // Ignore localStorage errors
    sidebarCollapsed = false;
    sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
  }
}

/**
 * Save sidebar state to localStorage
 */
function saveSidebarState() {
  try {
    localStorage.setItem(
      SIDEBAR_STATE_KEY,
      JSON.stringify({
        collapsed: sidebarCollapsed,
        width: sidebarWidth,
      })
    );
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Apply sidebar state to DOM
 */
function applySidebarState() {
  const sidebar = document.getElementById('modal-sidebar');
  const expandBtn = document.getElementById('sidebar-expand-btn');
  const resizer = document.getElementById('sidebar-resizer');

  if (!sidebar) return;

  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    expandBtn?.classList.remove('hidden');
    resizer?.classList.add('hidden');
  } else {
    sidebar.classList.remove('collapsed');
    sidebar.style.width = `${sidebarWidth}px`;
    expandBtn?.classList.add('hidden');
    resizer?.classList.remove('hidden');
  }
}

/**
 * Show sidebar (column mode)
 */
function showSidebar() {
  const sidebar = document.getElementById('modal-sidebar');
  const resizer = document.getElementById('sidebar-resizer');

  if (sidebar) {
    sidebar.classList.remove('hidden');
    applySidebarState();
  }
  if (resizer && !sidebarCollapsed) {
    resizer.classList.remove('hidden');
  }
}

/**
 * Hide sidebar (single task mode)
 */
function hideSidebar() {
  const sidebar = document.getElementById('modal-sidebar');
  const expandBtn = document.getElementById('sidebar-expand-btn');
  const resizer = document.getElementById('sidebar-resizer');

  sidebar?.classList.add('hidden');
  expandBtn?.classList.add('hidden');
  resizer?.classList.add('hidden');
}

/**
 * Setup sidebar collapse/expand handlers
 */
function setupSidebarCollapse() {
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const expandBtn = document.getElementById('sidebar-expand-btn');

  collapseBtn?.addEventListener('click', () => {
    sidebarCollapsed = true;
    applySidebarState();
    saveSidebarState();
  });

  expandBtn?.addEventListener('click', () => {
    sidebarCollapsed = false;
    applySidebarState();
    saveSidebarState();
  });
}

/**
 * Setup sidebar resize handler
 */
function setupSidebarResize() {
  const resizer = document.getElementById('sidebar-resizer');

  resizer?.addEventListener('mousedown', (e) => {
    isSidebarResizing = true;
    sidebarResizeStartX = e.clientX;
    sidebarStartWidth = sidebarWidth;
    resizer.classList.add('dragging');

    // Disable transition during resize for instant feedback
    const sidebar = document.getElementById('modal-sidebar');
    sidebar?.classList.add('resizing');

    e.preventDefault();
  });
}

/**
 * Handle sidebar resize during drag
 */
function handleSidebarResize(e) {
  const deltaX = e.clientX - sidebarResizeStartX;
  const newWidth = Math.max(
    MIN_SIDEBAR_WIDTH,
    Math.min(MAX_SIDEBAR_WIDTH, sidebarStartWidth + deltaX)
  );

  sidebarWidth = newWidth;

  const sidebar = document.getElementById('modal-sidebar');
  if (sidebar) {
    sidebar.style.width = `${newWidth}px`;
  }
}

/**
 * End sidebar resize
 */
function endSidebarResize() {
  isSidebarResizing = false;
  const resizer = document.getElementById('sidebar-resizer');
  resizer?.classList.remove('dragging');

  // Re-enable transition after resize
  const sidebar = document.getElementById('modal-sidebar');
  sidebar?.classList.remove('resizing');

  saveSidebarState();
}

/**
 * Render task list in sidebar
 */
function renderSidebarTasks(taskNames, progressData, isLoading = false) {
  const container = document.getElementById('sidebar-task-list');
  if (!container) return;

  container.innerHTML = taskNames
    .map((taskName, index) => {
      const status = isLoading
        ? 'loading'
        : getTaskStatusFromBoard({ name: taskName }, progressData || {});
      const statusClass = isLoading ? 'loading' : getStatusClass(status);
      const isActive = index === selectedTaskIndex;

      return `
        <div class="sidebar-task-item ${isActive ? 'active' : ''}"
             data-task-index="${index}"
             data-task-name="${taskName}"
             title="${taskName}">
          <svg class="sidebar-task-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="sidebar-task-name">${escapeHtml(taskName)}</span>
          <div class="sidebar-task-status-container">
            <span class="sidebar-task-status ${statusClass}"></span>
            <svg class="sidebar-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="7" cy="7" r="4.5"/>
              <path d="M10.5 10.5L14 14"/>
            </svg>
          </div>
        </div>
      `;
    })
    .join('');

  // Attach click handlers
  container.querySelectorAll('.sidebar-task-item').forEach((item) => {
    // Click on task name or item selects the task
    item.addEventListener('click', (e) => {
      // Don't select if clicking on search icon
      if (e.target.closest('.sidebar-search-icon')) return;

      const index = parseInt(item.dataset.taskIndex, 10);
      const name = item.dataset.taskName;
      selectSidebarTask(name, index);
    });

    // Click on search icon minimizes modal and searches for the task
    const searchIcon = item.querySelector('.sidebar-search-icon');
    if (searchIcon) {
      searchIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskName = item.dataset.taskName;

        // Minimize the modal
        minimizeModal();

        // Populate the task search input and trigger search
        const searchInput = document.getElementById('task-search-input');
        if (searchInput) {
          searchInput.value = taskName;
          searchInput.dispatchEvent(new Event('input'));
          searchInput.focus();
        }
      });
    }
  });
}

/**
 * Get CSS class for status
 */
function getStatusClass(status) {
  const statusMap = {
    pending: 'pending',
    'in-progress': 'in-progress',
    'code-review': 'review',
    completed: 'completed',
    blocked: 'blocked',
  };
  return statusMap[status] || 'pending';
}

/**
 * Update sidebar task status dots
 */
function updateSidebarTaskStatus(progressData) {
  const container = document.getElementById('sidebar-task-list');
  if (!container) return;

  container.querySelectorAll('.sidebar-task-item').forEach((item) => {
    const taskName = item.dataset.taskName;
    const status = getTaskStatusFromBoard(
      { name: taskName },
      progressData || {}
    );
    const statusClass = getStatusClass(status);

    // Status dot is now inside the status container
    const statusDot = item.querySelector(
      '.sidebar-task-status-container .sidebar-task-status'
    );
    if (statusDot) {
      statusDot.className = `sidebar-task-status ${statusClass}`;
    }
  });
}

/**
 * Handle click on sidebar task item
 */
function selectSidebarTask(taskName, index) {
  if (taskName === currentTaskName && index === selectedTaskIndex) return;

  selectedTaskIndex = index;
  currentTaskName = taskName;

  // Update active state in sidebar
  const container = document.getElementById('sidebar-task-list');
  container?.querySelectorAll('.sidebar-task-item').forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });

  // Update modal title
  const titleElement = modalElement?.querySelector('.modal-title');
  const columnNames = {
    all: 'All',
    pending: 'Pending',
    blocked: 'Hold',
    progress: 'In Progress',
    review: 'Code Review',
    completed: 'Completed',
  };
  if (titleElement && isColumnMode) {
    titleElement.textContent = `Column: ${columnNames[currentColumnId] || currentColumnId} - ${taskName}`;
  }

  // Clear caches and reload
  clearCache();
  checkTabDataAvailability();
  switchTab(currentTabName || 'board');
}
