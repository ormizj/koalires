/**
 * Metadata modal for viewing task JSON data
 * Extends BaseModal for drag/resize/minimize/maximize functionality
 */

import {
  BaseModal,
  taskbar,
  SidebarTaskList,
} from '../../shared/modal/index.js';
import { modalStore } from '../../shared/store/index.js';
import { getTaskStatus as getTaskStatusFromBoard } from '../../shared/tasks.js';

// Modal-specific state
let currentTaskName = null;

// Cached data
let boardDataCache = null;
let progressDataCache = null;
const logDataCache = new Map();
const outputDataCache = new Map();
const promptDataCache = new Map();

// QA mode state
let isQaMode = false;

// Auto-refresh state
let refreshInterval = null;
let currentTabData = null;
let currentTabName = null;

// Search state
let searchDebounceTimer = null;
let searchAbortController = null;
let searchMatches = [];
let currentMatchIndex = -1;

// Raw JSON data for copy functionality
let currentRawJsonData = null;

// Column mode state
let isColumnMode = false;
let currentColumnId = null;
let columnTasks = [];
let selectedTaskIndex = 0;

// Modal instance
let metadataModal = null;

// Sidebar task list instance
let sidebarTaskList = null;

// Column names mapping
const columnNames = {
  all: 'All',
  pending: 'Pending',
  blocked: 'Hold',
  progress: 'In Progress',
  review: 'Code Review',
  completed: 'Completed',
};

/**
 * Initialize metadata modal event listeners
 */
export function initMetadataModal() {
  const element = document.getElementById('metadata-modal');
  const overlay = document.getElementById('metadata-modal-overlay');

  if (!element || !overlay) return;

  // Create modal instance using BaseModal
  metadataModal = new BaseModal({
    id: 'metadata',
    element,
    overlay,
    type: 'metadata',
    minWidth: 500,
    minHeight: 400,
    defaultWidth: 700,
    defaultHeight: 600,
    sizeKey: 'kanban-metadata-modal-size',
    fullscreenKey: 'kanban-modal-fullscreen',
    sidebarConfig: {
      defaultWidth: 200,
      minWidth: 120,
      maxWidth: 400,
      stateKey: 'kanban-sidebar-state',
    },
    selectors: {
      header: '.modal-header',
      title: '.modal-title',
      close: '.modal-close',
      minimize: '.modal-minimize',
      maximize: '.modal-maximize',
      resizeHandles: '.resize-handle',
    },
  });

  // Initialize base modal functionality
  metadataModal.init();

  // Override minimize button to use custom minimizeModal() with proper displayInfo
  const minimizeBtn = element.querySelector('.modal-minimize');
  if (minimizeBtn) {
    const newMinimizeBtn = minimizeBtn.cloneNode(true);
    minimizeBtn.parentNode.replaceChild(newMinimizeBtn, minimizeBtn);
    newMinimizeBtn.addEventListener('click', () => minimizeModal());
  }

  // Override overlay click to use custom minimizeModal() with proper displayInfo
  metadataModal._onOverlayClick = (e) => {
    if (e.target === overlay) {
      minimizeModal();
    }
  };

  // Setup sidebar with DOM elements
  metadataModal.setupSidebar({
    sidebar: element.querySelector('#modal-sidebar'),
    resizer: element.querySelector('#sidebar-resizer'),
    collapseBtn: element.querySelector('#sidebar-collapse-btn'),
    expandBtn: element.querySelector('#sidebar-expand-btn'),
  });

  // Initialize sidebar task list
  sidebarTaskList = new SidebarTaskList({
    containerId: 'sidebar-task-list',
    getStatusFn: (taskName, progressData) =>
      getTaskStatusFromBoard({ name: taskName }, progressData || {}),
    onSelectFn: selectSidebarTask,
    features: {
      searchIcon: true,
      onSearchClick: (taskName) => {
        minimizeModal();
        const searchInput = document.getElementById('task-search-input');
        if (searchInput) {
          searchInput.value = taskName;
          searchInput.dispatchEvent(new Event('input'));
          searchInput.focus();
        }
      },
      loadingState: true,
      extendedIcon: true,
    },
  });

  // Listen for task modal opening - minimize ourselves if open
  document.addEventListener('taskModalOpening', () => {
    if (metadataModal.getIsVisible()) {
      minimizeModal();
    }
  });

  // Tab switching (modal-specific)
  element.querySelectorAll('.modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('disabled')) return;
      switchTab(tab.dataset.tab);
    });
  });

  // Initialize QA toggle
  initQaToggle();

  // Register taskbar restore/close/minimize callbacks
  taskbar.registerRestoreCallback('metadata', handleTaskbarRestore);
  taskbar.registerCloseCallback('metadata', handleTaskbarClose);
  taskbar.registerMinimizeCallback('metadata', handleTaskbarMinimize);
}

/**
 * Handle restore from taskbar
 */
function handleTaskbarRestore(id, restoredInfo) {
  if (!restoredInfo) return;

  if (
    restoredInfo.mode === 'column' &&
    restoredInfo.columnId &&
    restoredInfo.taskNames?.length > 0
  ) {
    showColumnModal(
      restoredInfo.columnId,
      restoredInfo.taskNames,
      restoredInfo.openedAt
    );
  } else if (restoredInfo.taskName) {
    showModal(restoredInfo.taskName, restoredInfo.openedAt);
  }
  // If neither condition met, silently fail rather than showing "Metadata: undefined"
}

/**
 * Handle close from taskbar (X button)
 */
function handleTaskbarClose(id, isFocused) {
  // X button always closes completely
  if (isFocused) {
    hideModal();
  } else {
    modalStore.unregisterModal(id);
  }
}

/**
 * Handle minimize from taskbar (clicking on focused item)
 */
function handleTaskbarMinimize(id) {
  minimizeModal();
}

/**
 * Show the modal for a specific task
 */
export function showModal(taskName, openedAt = null) {
  if (!metadataModal) return;

  // Notify other modals that we're opening
  document.dispatchEvent(new CustomEvent('metadataModalOpening'));

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
  metadataModal.sidebar?.hide();

  currentTaskName = taskName;

  // Show modal via BaseModal
  metadataModal.show({
    key: taskName,
    title: `Metadata: ${taskName}`,
    openedAt,
    displayInfo: {
      mode: 'single',
      taskName: taskName,
    },
  });

  // Clear search
  clearSearch();

  // Check which tabs have data available
  checkTabDataAvailability();

  // Load default tab (board)
  switchTab('board');

  // Start auto-refresh polling
  startRefreshPolling();
}

/**
 * Show the modal for a column with multiple tasks
 */
export async function showColumnModal(columnId, taskNames, openedAt = null) {
  if (!metadataModal || taskNames.length === 0) return;

  // Notify other modals that we're opening
  document.dispatchEvent(new CustomEvent('metadataModalOpening'));

  const newModalKey = `column-${columnId}`;

  isColumnMode = true;
  currentColumnId = columnId;
  columnTasks = taskNames;
  selectedTaskIndex = 0;
  currentTaskName = taskNames[0];

  // Show modal via BaseModal
  metadataModal.show({
    key: newModalKey,
    title: `Column: ${columnNames[columnId] || columnId}`,
    openedAt,
    displayInfo: {
      mode: 'column',
      columnId: columnId,
      taskNames: [...taskNames],
      taskName: taskNames[0],
    },
  });

  // Show sidebar and render task list with loading state
  metadataModal.sidebar?.show();
  sidebarTaskList.render(taskNames, null, true);

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
      sidebarTaskList.updateStatus(progressDataCache);
    }
  } catch (e) {
    console.warn('Failed to fetch initial progress data:', e);
  }

  // Clear search
  clearSearch();

  // Check tab data availability and load first task
  checkTabDataAvailability();
  switchTab('board');

  // Start auto-refresh
  startRefreshPolling();
}

/**
 * Hide the modal
 */
export function hideModal() {
  if (!metadataModal) return;

  // Stop auto-refresh polling
  stopRefreshPolling();

  // Hide modal via BaseModal
  metadataModal.hide();

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
  metadataModal.sidebar?.hide();

  currentTaskName = null;
  currentTabData = null;
  currentTabName = null;
}

/**
 * Minimize the current modal to the status bar
 */
function minimizeModal() {
  if (!metadataModal || !currentTaskName) return;

  // Stop auto-refresh polling
  stopRefreshPolling();

  // Minimize via BaseModal
  metadataModal.minimize({
    title: isColumnMode
      ? `Column: ${columnNames[currentColumnId] || currentColumnId}`
      : currentTaskName,
    mode: isColumnMode ? 'column' : 'single',
    columnId: isColumnMode ? currentColumnId : null,
    taskNames: isColumnMode ? [...columnTasks] : null,
    taskName: currentTaskName,
  });
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
 * Clear search state
 */
function clearSearch() {
  const searchInput = document.getElementById('metadata-search');
  if (searchInput) {
    searchInput.value = '';
  }
  searchMatches = [];
  currentMatchIndex = -1;
  updateSearchCount();
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
  if (!metadataModal?.element || !currentTaskName) return;

  const modalElement = metadataModal.element;
  const tabs = {
    board: modalElement.querySelector('[data-tab="board"]'),
    progress: modalElement.querySelector('[data-tab="progress"]'),
    prompt: modalElement.querySelector('[data-tab="prompt"]'),
    log: modalElement.querySelector('[data-tab="log"]'),
    output: modalElement.querySelector('[data-tab="output"]'),
  };

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
      `../worker-logs/${currentTaskName}${suffix}.txt?t=${Date.now()}`
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
 * Switch between tabs
 */
async function switchTab(tabName) {
  if (!metadataModal?.element) return;

  const modalElement = metadataModal.element;
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
  clearSearch();

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
  const contentElement =
    metadataModal?.element?.querySelector('.modal-content');
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

    // Store raw JSON for copy functionality
    currentRawJsonData = data;

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

  const taskEntry = boardDataCache.tasks?.find(
    (t) => t.name === currentTaskName
  );
  return taskEntry || null;
}

/**
 * Fetch worker-logs/{taskName}.txt (supports both JSON and JSONL formats)
 */
async function fetchLogData() {
  if (!currentTaskName) return null;

  const suffix = getWorkerFileSuffix();
  const cacheKey = `${currentTaskName}${suffix}`;

  if (!logDataCache.has(cacheKey)) {
    try {
      const response = await fetch(
        `../worker-logs/${currentTaskName}${suffix}.txt?t=${Date.now()}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Log file not found: worker-logs/${currentTaskName}${suffix}.txt`
          );
        }
        throw new Error(`Failed to load log file (${response.status})`);
      }

      let text = await response.text();

      // Strip UTF-8 BOM if present
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        // Fall back to JSONL
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
        `Log file not found: worker-logs/${currentTaskName}${suffix}.txt`
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
 * Creates a node for primitive values
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

  let headerHtml = '<span class="json-toggle">&#9660;</span>';

  if (key !== null) {
    const keyStr = escapeHtml(JSON.stringify(key));
    headerHtml += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
    headerHtml += '<span class="json-colon">: </span>';
  }

  headerHtml += '<span class="json-brace">{</span>';
  headerHtml += `<span class="json-summary">${count} ${count === 1 ? 'item' : 'items'}</span>`;

  node.innerHTML = headerHtml;

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

  let headerHtml = '<span class="json-toggle">&#9660;</span>';

  if (key !== null) {
    const keyStr = escapeHtml(JSON.stringify(key));
    headerHtml += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
    headerHtml += '<span class="json-colon">: </span>';
  }

  headerHtml += '<span class="json-bracket">[</span>';
  headerHtml += `<span class="json-summary">${count} ${count === 1 ? 'item' : 'items'}</span>`;

  node.innerHTML = headerHtml;

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
  container.addEventListener('click', (e) => {
    const toggle = e.target.closest('.json-toggle');
    if (toggle) {
      const node = toggle.closest('.json-node');
      if (node) {
        toggleNode(node);
      }
    }
  });

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
 * Create search bar HTML
 */
function createSearchBar() {
  const searchBar = document.createElement('div');
  searchBar.className = 'json-viewer-search';
  searchBar.innerHTML = `
    <button id="copy-json" class="copy-btn" title="Copy JSON">Copy All</button>
    <div class="search-input-wrapper">
      <input type="text" id="metadata-search" placeholder="Search JSON..." />
      <button id="search-clear" class="search-clear" title="Clear search">&times;</button>
    </div>
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
 * Bind search event listeners
 */
function bindSearchListeners(container) {
  const searchInput = container.querySelector('#metadata-search');
  const prevBtn = container.querySelector('#search-prev');
  const nextBtn = container.querySelector('#search-next');
  const copyBtn = container.querySelector('#copy-json');
  const clearBtn = container.querySelector('#search-clear');

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
  copyBtn?.addEventListener('click', copyJson);
  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
  });
}

/**
 * Async search with batched processing
 */
async function searchJsonAsync(container, query) {
  if (searchAbortController) {
    searchAbortController.abort();
  }

  clearSearchHighlights(container);
  searchMatches = [];
  currentMatchIndex = -1;

  if (!query) {
    updateSearchUI(null, 0);
    return;
  }

  searchAbortController = new AbortController();
  const signal = searchAbortController.signal;

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

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (signal.aborted) return;

    expandSearchMatches(container, searchMatches);
    updateSearchUI(searchMatches.length, searchMatches.length);

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

  const prevCurrent = document.querySelector('.json-match.current');
  if (prevCurrent) {
    prevCurrent.classList.remove('current');
  }

  if (index < 0) index = searchMatches.length - 1;
  if (index >= searchMatches.length) index = 0;

  currentMatchIndex = index;

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
 * Smart copy - copies matches if search active, otherwise copies all JSON
 */
function copyJson() {
  let text;

  if (searchMatches.length > 0) {
    // Copy matches
    const results = [];
    const matches = document.querySelectorAll('.json-match');
    matches.forEach((match) => {
      const parent = match.closest('.json-node');
      if (parent) {
        results.push(parent.textContent.trim());
      }
    });
    text = results.join('\n');
  } else {
    // Copy all
    if (!currentRawJsonData) return;
    text = JSON.stringify(currentRawJsonData, null, 2);
  }

  navigator.clipboard.writeText(text).then(() => {
    showCopyFeedback('copy-json', 'Copied!');
  });
}

/**
 * Show feedback on copy button
 */
function showCopyFeedback(buttonId, message) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.dataset.originalText = btn.textContent;
  btn.textContent = message;
  setTimeout(() => {
    btn.textContent = btn.dataset.originalText;
  }, 1500);
}

/**
 * Update search UI elements
 */
function updateSearchUI(count, total) {
  updateSearchCount();
  updateSearchStatus('');

  const prevBtn = document.getElementById('search-prev');
  const nextBtn = document.getElementById('search-next');
  const copyBtn = document.getElementById('copy-json');

  if (prevBtn) prevBtn.disabled = !searchMatches.length;
  if (nextBtn) nextBtn.disabled = !searchMatches.length;

  // Update copy button text based on search state
  if (copyBtn) {
    copyBtn.textContent =
      searchMatches.length > 0 ? 'Copy Selected' : 'Copy All';
  }
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
  if (!currentTabName || !metadataModal?.element) return;

  // Clear cache before fetching to get fresh data
  clearCache();

  // Re-check tab availability
  checkTabDataAvailability();

  const newData = await fetchTabData(currentTabName);

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
    sidebarTaskList.updateStatus(progressDataCache);
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

// ===== Sidebar Functions =====

/**
 * Handle click on sidebar task item
 */
function selectSidebarTask(taskName, index) {
  if (taskName === currentTaskName && index === selectedTaskIndex) return;

  selectedTaskIndex = index;
  currentTaskName = taskName;

  // Update active state in sidebar via shared class
  sidebarTaskList.setActiveIndex(index);

  // Update modal title
  const titleElement = metadataModal?.element?.querySelector('.modal-title');
  if (titleElement && isColumnMode) {
    titleElement.textContent = `Column: ${columnNames[currentColumnId] || currentColumnId} - ${taskName}`;
  }

  // Clear caches and reload
  clearCache();
  checkTabDataAvailability();
  switchTab(currentTabName || 'board');
}
