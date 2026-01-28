/**
 * Task modal for viewing task details in user-friendly format
 * Extends BaseModal for drag/resize/minimize/maximize functionality
 */

import {
  BaseModal,
  taskbar,
  SidebarTaskList,
} from '../../shared/modal/index.js';
import { modalStore } from '../../shared/store/index.js';
import { getBoardData, getProgressData } from '../../core/data.js';
import { getTaskStatus } from '../../shared/tasks.js';
import { getIcon } from '../../shared/utils/icons.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import {
  parseMarkdown,
  formatDate,
  formatRelativeTime,
  calculateDuration,
} from '../../shared/utils/format.js';

// Modal-specific state
let currentTaskName = null;

// Column mode state
let isColumnMode = false;
let currentColumnId = null;
let columnTasks = [];
let selectedTaskIndex = 0;

// Keyboard navigation state
let keyboardListenerActive = false;

// Auto-refresh state
let refreshInterval = null;

// Modal instance
let taskModal = null;

// Sidebar task list instance
let sidebarTaskList = null;

// Details panel state
let detailsCollapsed = false;
let detailsWidth = 220;
const DETAILS_MIN_WIDTH = 150;
const DETAILS_MAX_WIDTH = 400;
const DETAILS_DEFAULT_WIDTH = 220;
const DETAILS_COLLAPSED_KEY = 'kanban-task-details-collapsed';
const DETAILS_WIDTH_KEY = 'kanban-task-details-width';

// Details panel elements (cached)
let detailsPanel = null;
let detailsResizer = null;
let detailsCollapseBtn = null;
let detailsExpandBtn = null;

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
 * Initialize task modal event listeners
 */
export function initTaskModal() {
  const element = document.getElementById('task-modal');
  const overlay = document.getElementById('task-modal-overlay');

  if (!element || !overlay) return;

  // Create modal instance using BaseModal
  taskModal = new BaseModal({
    id: 'task',
    element,
    overlay,
    type: 'task',
    minWidth: 600,
    minHeight: 450,
    defaultWidth: 850,
    defaultHeight: 650,
    sizeKey: 'kanban-task-modal-size',
    fullscreenKey: 'kanban-task-modal-fullscreen',
    sidebarConfig: {
      defaultWidth: 200,
      minWidth: 120,
      maxWidth: 400,
      stateKey: 'kanban-task-sidebar-state',
    },
    selectors: {
      header: '.task-modal-header',
      title: '.task-modal-title',
      close: '.task-modal-close',
      minimize: '.task-modal-minimize',
      maximize: '.task-modal-maximize',
      resizeHandles: '.resize-handle',
    },
  });

  // Initialize base modal functionality
  taskModal.init();

  // Override minimize button to use custom minimizeModal() with proper displayInfo
  // BaseModal's default handler calls minimize() with empty displayInfo, losing taskName
  const minimizeBtn = element.querySelector('.task-modal-minimize');
  if (minimizeBtn) {
    const newMinimizeBtn = minimizeBtn.cloneNode(true);
    minimizeBtn.parentNode.replaceChild(newMinimizeBtn, minimizeBtn);
    newMinimizeBtn.addEventListener('click', () => minimizeModal());
  }

  // Override overlay click to use custom minimizeModal() with proper displayInfo
  // BaseModal's default handler calls minimize() with empty displayInfo
  taskModal._onOverlayClick = (e) => {
    if (e.target === overlay) {
      minimizeModal();
    }
  };

  // Setup sidebar with DOM elements
  taskModal.setupSidebar({
    sidebar: element.querySelector('#task-modal-sidebar'),
    resizer: element.querySelector('#task-modal-sidebar-resizer'),
    collapseBtn: element.querySelector('#task-modal-sidebar-collapse'),
    expandBtn: element.querySelector('#task-modal-sidebar-expand'),
  });

  // Initialize sidebar task list
  sidebarTaskList = new SidebarTaskList({
    containerId: 'task-modal-sidebar-list',
    getStatusFn: (taskName, progressData) =>
      getTaskStatus({ name: taskName }, progressData || {}),
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

  // Listen for metadata modal opening - minimize ourselves if open
  document.addEventListener('metadataModalOpening', () => {
    if (taskModal.getIsVisible()) {
      minimizeModal();
    }
  });

  // Register taskbar restore/close/minimize callbacks
  taskbar.registerRestoreCallback('task', handleTaskbarRestore);
  taskbar.registerCloseCallback('task', handleTaskbarClose);
  taskbar.registerMinimizeCallback('task', handleTaskbarMinimize);

  // Initialize details panel
  initDetailsPanel(element);
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
    showColumnTaskModal(
      restoredInfo.columnId,
      restoredInfo.taskNames,
      restoredInfo.openedAt
    );
  } else if (restoredInfo.taskName) {
    showTaskModal(restoredInfo.taskName, restoredInfo.openedAt);
  }
  // If neither condition met, silently fail rather than showing "Task: undefined"
}

/**
 * Handle close from taskbar (X button)
 */
function handleTaskbarClose(id, isFocused) {
  // X button always closes completely
  if (isFocused) {
    hideTaskModal();
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
 * Show task modal for a single task
 */
export function showTaskModal(taskName, openedAt = null) {
  if (!taskModal) return;

  // Notify other modals that we're opening
  document.dispatchEvent(new CustomEvent('taskModalOpening'));

  // Reset column mode state (single task mode)
  isColumnMode = false;
  currentColumnId = null;
  columnTasks = [];
  selectedTaskIndex = 0;

  // Hide sidebar in single task mode
  taskModal.sidebar?.hide();

  currentTaskName = taskName;

  // Show modal via BaseModal
  taskModal.show({
    key: taskName,
    title: `Task: ${taskName}`,
    openedAt,
    displayInfo: {
      mode: 'single',
      taskName: taskName,
    },
  });

  // Render task content
  renderTaskContent();

  // Start auto-refresh polling
  startRefreshPolling();

  // Activate keyboard navigation
  activateKeyboardNavigation();
}

/**
 * Show task modal for a column with multiple tasks
 */
export async function showColumnTaskModal(
  columnId,
  taskNames,
  openedAt = null
) {
  if (!taskModal || taskNames.length === 0) return;

  // Notify other modals that we're opening
  document.dispatchEvent(new CustomEvent('taskModalOpening'));

  const newModalKey = `task-column-${columnId}`;

  isColumnMode = true;
  currentColumnId = columnId;
  columnTasks = taskNames;
  selectedTaskIndex = 0;
  currentTaskName = taskNames[0];

  // Show modal via BaseModal
  taskModal.show({
    key: newModalKey,
    title: `${columnNames[columnId] || columnId}`,
    openedAt,
    displayInfo: {
      mode: 'column',
      columnId: columnId,
      taskNames: [...taskNames],
      taskName: taskNames[0],
    },
  });

  // Show sidebar and render task list
  taskModal.sidebar?.show();
  sidebarTaskList.render(taskNames, getProgressData());

  // Render first task content
  renderTaskContent();

  // Start auto-refresh
  startRefreshPolling();

  // Activate keyboard navigation
  activateKeyboardNavigation();
}

/**
 * Hide the task modal
 */
export function hideTaskModal() {
  if (!taskModal) return;

  // Deactivate keyboard navigation
  deactivateKeyboardNavigation();

  // Stop auto-refresh polling
  stopRefreshPolling();

  // Hide modal via BaseModal
  taskModal.hide();

  // Reset column mode state
  isColumnMode = false;
  currentColumnId = null;
  columnTasks = [];
  selectedTaskIndex = 0;

  // Hide sidebar
  taskModal.sidebar?.hide();

  currentTaskName = null;
}

/**
 * Minimize the current modal to the status bar
 */
function minimizeModal() {
  if (!taskModal || !currentTaskName) return;

  // Stop auto-refresh polling
  stopRefreshPolling();

  // Deactivate keyboard navigation
  deactivateKeyboardNavigation();

  // Minimize via BaseModal
  taskModal.minimize({
    title: isColumnMode
      ? `${columnNames[currentColumnId] || currentColumnId}`
      : currentTaskName,
    mode: isColumnMode ? 'column' : 'single',
    columnId: isColumnMode ? currentColumnId : null,
    taskNames: isColumnMode ? [...columnTasks] : null,
    taskName: currentTaskName,
  });
}

/**
 * Render task content in the modal
 */
function renderTaskContent() {
  if (!currentTaskName || !taskModal?.element) return;

  const boardData = getBoardData();
  const progressData = getProgressData();

  const task = boardData?.tasks?.find((t) => t.name === currentTaskName);
  const progress = progressData?.[currentTaskName];
  const status = task ? getTaskStatus(task, progressData || {}) : 'pending';

  const detailsElement = taskModal.element.querySelector(
    '.task-modal-details-content'
  );
  const contentElement = taskModal.element.querySelector('.task-modal-content');

  if (!detailsElement || !contentElement) return;

  // Render right sidebar (details) - content goes inside the content wrapper
  detailsElement.innerHTML = renderTaskDetails(task, progress, status);

  // Render main content (description, steps, work log)
  contentElement.innerHTML = renderTaskMainContent(task, progress);
}

/**
 * Render task details (left column)
 */
function renderTaskDetails(task, progress, status) {
  if (!task) {
    return '<div class="task-detail-empty">Task not found</div>';
  }

  const statusLabels = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    'code-review': 'Code Review',
    completed: 'Completed',
    blocked: 'Hold',
  };

  const statusColors = {
    pending: '#8b949e',
    'in-progress': '#f0883e',
    'code-review': '#a371f7',
    completed: '#3fb950',
    blocked: '#f85149',
  };

  let html = '';

  // Status
  html += `
    <div class="task-detail-section">
      <div class="task-detail-label">Status</div>
      <div class="task-detail-value">
        <span class="task-status-badge" style="background: ${statusColors[status]}20; color: ${statusColors[status]}; border: 1px solid ${statusColors[status]}40;">
          ${statusLabels[status] || status}
        </span>
      </div>
    </div>
  `;

  // Category
  if (task.category) {
    html += `
      <div class="task-detail-section">
        <div class="task-detail-label">Category</div>
        <div class="task-detail-value">
          <span class="task-category-badge category-${task.category}">${escapeHtml(task.category)}</span>
        </div>
      </div>
    `;
  }

  // Timestamps
  const startedAt = progress?.startedAt;
  const completedAt = progress?.completedAt;
  const duration = calculateDuration(startedAt, completedAt);

  if (startedAt) {
    html += `
      <div class="task-detail-section">
        <div class="task-detail-label">Started</div>
        <div class="task-detail-value task-detail-time" title="Started: ${formatDate(startedAt)}">
          ${getIcon('play', 14)}
          <span>${formatRelativeTime(startedAt)}</span>
        </div>
      </div>
    `;
  }

  if (completedAt) {
    html += `
      <div class="task-detail-section">
        <div class="task-detail-label">Completed</div>
        <div class="task-detail-value task-detail-time" title="Completed: ${formatDate(completedAt)}">
          ${getIcon('check', 14)}
          <span>${formatRelativeTime(completedAt)}</span>
        </div>
      </div>
    `;
  }

  if (duration) {
    // Calculate full duration for tooltip
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end - start;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHour / 24);
    const remainHour = diffHour % 24;
    const remainMin = diffMin % 60;
    const remainSec = diffSec % 60;
    let durationFull;
    if (diffDays > 0) {
      durationFull = `${diffDays}:${String(remainHour).padStart(2, '0')}:${String(remainMin).padStart(2, '0')}:${String(remainSec).padStart(2, '0')}`;
    } else if (remainHour > 0) {
      durationFull = `${String(remainHour).padStart(2, '0')}:${String(remainMin).padStart(2, '0')}:${String(remainSec).padStart(2, '0')}`;
    } else {
      durationFull = `${String(remainMin).padStart(2, '0')}:${String(remainSec).padStart(2, '0')}`;
    }

    html += `
      <div class="task-detail-section">
        <div class="task-detail-label">Duration</div>
        <div class="task-detail-value task-detail-time" title="Duration: ${durationFull}">
          ${getIcon('clock', 14)}
          <span>${duration}</span>
        </div>
      </div>
    `;
  }

  // Token usage
  const tokensUsed = progress?.tokensUsed || [];
  const finalTokens =
    tokensUsed.length > 0 ? tokensUsed[tokensUsed.length - 1] : 0;
  const tokenLimit = 200000;

  if (finalTokens > 0) {
    const tokenPercent = ((finalTokens / tokenLimit) * 100).toFixed(1);
    const tokenColor =
      tokenPercent > 90 ? '#f85149' : tokenPercent > 75 ? '#f0883e' : '#58a6ff';

    html += `
      <div class="task-detail-section">
        <div class="task-detail-label">Tokens</div>
        <div class="task-detail-value" title="Tokens used: ${finalTokens.toLocaleString()}">
          <div class="task-detail-tokens">
            ${getIcon('coin', 14)}
            <span>${finalTokens.toLocaleString()} / ${tokenLimit.toLocaleString()}</span>
            <span class="task-detail-token-percent" style="color: ${tokenColor};">${tokenPercent}%</span>
          </div>
          <div class="task-detail-token-bar">
            <div class="task-detail-token-fill" style="width: ${tokenPercent}%; background: ${tokenColor};"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Agents
  const agentData = progress?.agent;
  const tddAgent = progress?.tddAgent;

  if (agentData || tddAgent) {
    html += `
      <div class="task-detail-section">
        <div class="task-detail-label">Agents</div>
        <div class="task-detail-value task-detail-agents">
    `;

    if (typeof agentData === 'string') {
      html += `<span class="task-agent-badge">${escapeHtml(agentData)}</span>`;
    } else if (Array.isArray(agentData)) {
      agentData.forEach((a) => {
        html += `<span class="task-agent-badge">${escapeHtml(a)}</span>`;
      });
    }

    if (tddAgent) {
      html += `<span class="task-agent-badge task-agent-qa">${escapeHtml(tddAgent)}</span>`;
    }

    html += `
        </div>
      </div>
    `;
  }

  // Affected Files
  const affectedFiles = progress?.affectedFiles || [];
  const filesCreated = progress?.filesCreated || [];
  const filesModified = progress?.filesModified || [];
  const allFiles =
    affectedFiles.length > 0
      ? affectedFiles
      : [...filesCreated, ...filesModified];

  if (allFiles.length > 0) {
    html += `
      <div class="task-detail-section">
        <div class="task-detail-label">Files (${allFiles.length})</div>
        <div class="task-detail-value task-detail-files">
    `;

    allFiles.slice(0, 10).forEach((file) => {
      html += `<div class="task-file-item" title="${escapeHtml(file)}">${escapeHtml(file)}</div>`;
    });

    if (allFiles.length > 10) {
      html += `<div class="task-files-more">+${allFiles.length - 10} more files</div>`;
    }

    html += `
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Load collapsed sections state from localStorage
 */
function loadSectionsState() {
  try {
    return JSON.parse(
      localStorage.getItem('kanban-task-sections-state') || '{}'
    );
  } catch {
    return {};
  }
}

/**
 * Save collapsed sections state to localStorage
 */
function saveSectionsState(state) {
  try {
    localStorage.setItem('kanban-task-sections-state', JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initialize section toggle handlers after content is rendered
 */
function initSectionToggleHandlers() {
  const sections = document.querySelectorAll(
    '.task-content-section[data-section]'
  );

  sections.forEach((section) => {
    const header = section.querySelector('.task-content-header');
    if (header) {
      header.addEventListener('click', () => {
        const sectionName = section.getAttribute('data-section');
        const isCollapsed = section.classList.toggle('collapsed');

        // Save state to localStorage
        const state = loadSectionsState();
        state[sectionName] = isCollapsed;
        saveSectionsState(state);
      });
    }
  });
}

/**
 * Render task main content (right column)
 */
function renderTaskMainContent(task, progress) {
  if (!task) {
    return '<div class="task-content-empty">Task not found</div>';
  }

  const savedState = loadSectionsState();
  let html = '';

  // Description
  const descCollapsed = savedState['description'] ? ' collapsed' : '';
  html += `
    <div class="task-content-section${descCollapsed}" data-section="description">
      <div class="task-content-header">
        ${getIcon('file', 16)}
        <span>Description</span>
      </div>
      <div class="task-content-body task-description-content">
        ${parseMarkdown(task.description || 'No description provided.')}
      </div>
    </div>
  `;

  // Verification Steps
  if (task.steps && task.steps.length > 0) {
    const verifyCollapsed = savedState['verification'] ? ' collapsed' : '';
    html += `
      <div class="task-content-section${verifyCollapsed}" data-section="verification">
        <div class="task-content-header">
          ${getIcon('list', 16)}
          <span>Verification Steps (${task.steps.length})</span>
        </div>
        <div class="task-content-body task-steps-content">
          <ul class="task-steps-list">
    `;

    task.steps.forEach((step, index) => {
      const isCompleted =
        task.passes === true || progress?.status === 'completed';
      html += `
        <li class="task-step-item ${isCompleted ? 'completed' : ''}">
          <span class="task-step-checkbox">${isCompleted ? '&#10003;' : ''}</span>
          <span class="task-step-text">${escapeHtml(step)}</span>
        </li>
      `;
    });

    html += `
          </ul>
        </div>
      </div>
    `;
  }

  // Work Log
  const workLog = progress?.workLog || [];
  if (workLog.length > 0) {
    const worklogCollapsed = savedState['worklog'] ? ' collapsed' : '';
    html += `
      <div class="task-content-section${worklogCollapsed}" data-section="worklog">
        <div class="task-content-header">
          ${getIcon('activity', 16)}
          <span>Work Log (${workLog.length} entries)</span>
        </div>
        <div class="task-content-body task-log-content">
          <ul class="task-log-list">
    `;

    workLog.forEach((entry) => {
      html += `<li class="task-log-entry">${escapeHtml(entry)}</li>`;
    });

    html += `
          </ul>
        </div>
      </div>
    `;
  }

  // Schedule toggle handler initialization after DOM update
  setTimeout(initSectionToggleHandlers, 0);

  return html;
}

// ===== Keyboard Navigation =====

/**
 * Handle keyboard navigation for tasks
 */
function handleKeyDown(e) {
  // Skip if modal not visible
  if (!taskModal?.getIsVisible()) return;

  // Skip if input/textarea is focused
  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

  const { key } = e;

  // Task navigation (Arrow Up/Down) - only in column mode with sidebar
  if ((key === 'ArrowDown' || key === 'ArrowUp') && isColumnMode) {
    e.preventDefault();
    const taskCount = columnTasks.length;
    if (taskCount === 0) return;

    if (key === 'ArrowDown' && selectedTaskIndex < taskCount - 1) {
      const newIndex = selectedTaskIndex + 1;
      selectSidebarTask(columnTasks[newIndex], newIndex);
    } else if (key === 'ArrowUp' && selectedTaskIndex > 0) {
      const newIndex = selectedTaskIndex - 1;
      selectSidebarTask(columnTasks[newIndex], newIndex);
    }
  }
}

/**
 * Activate keyboard navigation listener
 */
function activateKeyboardNavigation() {
  if (!keyboardListenerActive) {
    document.addEventListener('keydown', handleKeyDown);
    keyboardListenerActive = true;
  }
}

/**
 * Deactivate keyboard navigation listener
 */
function deactivateKeyboardNavigation() {
  if (keyboardListenerActive) {
    document.removeEventListener('keydown', handleKeyDown);
    keyboardListenerActive = false;
  }
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
  const titleElement = taskModal?.element?.querySelector('.task-modal-title');
  if (titleElement && isColumnMode) {
    titleElement.textContent = `${columnNames[currentColumnId] || currentColumnId}`;
  }

  // Render new task content
  renderTaskContent();
}

// ===== Details Panel =====

/**
 * Initialize details panel elements and event listeners
 */
function initDetailsPanel(element) {
  detailsPanel = element.querySelector('#task-modal-details');
  detailsResizer = element.querySelector('#task-modal-details-resizer');
  detailsCollapseBtn = element.querySelector('#task-modal-details-collapse');
  detailsExpandBtn = element.querySelector('#task-modal-details-expand');

  if (!detailsPanel) return;

  // Load saved state
  loadDetailsState();

  // Apply initial state
  applyDetailsState();

  // Set up collapse button
  if (detailsCollapseBtn) {
    detailsCollapseBtn.addEventListener('click', collapseDetails);
  }

  // Set up expand button
  if (detailsExpandBtn) {
    detailsExpandBtn.addEventListener('click', expandDetails);
  }

  // Set up resizer
  if (detailsResizer) {
    initDetailsResizer();
  }
}

/**
 * Load details panel state from localStorage
 */
function loadDetailsState() {
  try {
    const savedCollapsed = localStorage.getItem(DETAILS_COLLAPSED_KEY);
    if (savedCollapsed !== null) {
      detailsCollapsed = savedCollapsed === 'true';
    }

    const savedWidth = localStorage.getItem(DETAILS_WIDTH_KEY);
    if (savedWidth !== null) {
      const parsed = parseInt(savedWidth, 10);
      if (
        !isNaN(parsed) &&
        parsed >= DETAILS_MIN_WIDTH &&
        parsed <= DETAILS_MAX_WIDTH
      ) {
        detailsWidth = parsed;
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Save details panel state to localStorage
 */
function saveDetailsState() {
  try {
    localStorage.setItem(DETAILS_COLLAPSED_KEY, String(detailsCollapsed));
    localStorage.setItem(DETAILS_WIDTH_KEY, String(detailsWidth));
  } catch (e) {
    // Ignore localStorage errors
  }
}

/**
 * Apply current details panel state to DOM
 */
function applyDetailsState() {
  if (!detailsPanel) return;

  if (detailsCollapsed) {
    detailsPanel.classList.add('collapsed');
    detailsResizer?.classList.add('hidden');
    detailsExpandBtn?.classList.remove('hidden');
  } else {
    detailsPanel.classList.remove('collapsed');
    detailsPanel.style.width = `${detailsWidth}px`;
    detailsResizer?.classList.remove('hidden');
    detailsExpandBtn?.classList.add('hidden');
  }
}

/**
 * Collapse the details panel
 */
function collapseDetails() {
  detailsCollapsed = true;
  saveDetailsState();
  applyDetailsState();
}

/**
 * Expand the details panel
 */
function expandDetails() {
  detailsCollapsed = false;
  saveDetailsState();
  applyDetailsState();
}

/**
 * Initialize details panel resizer
 */
function initDetailsResizer() {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const onMouseDown = (e) => {
    if (detailsCollapsed) return;

    isResizing = true;
    startX = e.clientX;
    startWidth = detailsPanel.offsetWidth;

    detailsPanel.classList.add('resizing');
    detailsResizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!isResizing) return;

    // Resizer is on the left of details panel, so dragging left = wider
    const delta = startX - e.clientX;
    let newWidth = startWidth + delta;

    // Clamp to min/max
    newWidth = Math.max(
      DETAILS_MIN_WIDTH,
      Math.min(DETAILS_MAX_WIDTH, newWidth)
    );

    detailsWidth = newWidth;
    detailsPanel.style.width = `${newWidth}px`;
  };

  const onMouseUp = () => {
    if (!isResizing) return;

    isResizing = false;
    detailsPanel.classList.remove('resizing');
    detailsResizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Save new width
    saveDetailsState();
  };

  detailsResizer.addEventListener('mousedown', onMouseDown);
}

// ===== Auto-Refresh =====

/**
 * Start auto-refresh polling (every 1 second)
 */
function startRefreshPolling() {
  stopRefreshPolling();
  refreshInterval = setInterval(() => {
    renderTaskContent();
    if (isColumnMode) {
      sidebarTaskList.updateStatus(getProgressData());
    }
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
