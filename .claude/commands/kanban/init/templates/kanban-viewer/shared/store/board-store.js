/**
 * Board Store - Manages board data and column visibility states
 * Centralizes data caching and column state persistence
 */

const COLUMN_STATE_KEY = 'kanban-column-state';

export const boardStore = {
  // Board data
  boardData: null,
  progressData: null,

  // Serialized versions for change detection
  _lastBoardDataStr: null,
  _lastProgressDataStr: null,

  // Column visibility state
  minimizedColumns: new Set(),
  maximizedColumn: null,
  autoCollapseColumns: new Set(),

  // Expanded task cards
  expandedTasks: new Set(),

  // Subscribers for state changes
  _subscribers: new Set(),

  // ===== Data Methods =====

  /**
   * Set board data
   * @param {Object} data - Board data from kanban-board.json
   */
  setBoardData(data) {
    this.boardData = data;
  },

  /**
   * Get board data
   * @returns {Object|null} Current board data
   */
  getBoardData() {
    return this.boardData;
  },

  /**
   * Set progress data
   * @param {Object} data - Progress data from kanban-progress.json
   */
  setProgressData(data) {
    this.progressData = data;
  },

  /**
   * Get progress data
   * @returns {Object|null} Current progress data
   */
  getProgressData() {
    return this.progressData;
  },

  /**
   * Check if board data has changed since last check
   * @param {Object} newBoardData - New board data to compare
   * @param {Object} newProgressData - New progress data to compare
   * @returns {boolean} True if data has changed
   */
  hasDataChanged(newBoardData, newProgressData) {
    const newBoardStr = JSON.stringify(newBoardData);
    const newProgressStr = JSON.stringify(newProgressData);

    const changed =
      newBoardStr !== this._lastBoardDataStr ||
      newProgressStr !== this._lastProgressDataStr;

    if (changed) {
      this._lastBoardDataStr = newBoardStr;
      this._lastProgressDataStr = newProgressStr;
    }

    return changed;
  },

  /**
   * Clear cached data
   */
  clearData() {
    this.boardData = null;
    this.progressData = null;
    this._lastBoardDataStr = null;
    this._lastProgressDataStr = null;
  },

  /**
   * Get task by name from board data
   * @param {string} taskName - Task name to find
   * @returns {Object|null} Task object or null
   */
  getTask(taskName) {
    return this.boardData?.tasks?.find((t) => t.name === taskName) || null;
  },

  /**
   * Get task progress by name
   * @param {string} taskName - Task name to find
   * @returns {Object|null} Progress object or null
   */
  getTaskProgress(taskName) {
    return this.progressData?.[taskName] || null;
  },

  // ===== Column State Methods =====

  /**
   * Toggle column minimized state
   * @param {string} columnId - Column identifier
   */
  toggleColumnMinimized(columnId) {
    if (this.minimizedColumns.has(columnId)) {
      this.minimizedColumns.delete(columnId);
    } else {
      this.minimizedColumns.add(columnId);
    }
    this._notifySubscribers('columnState');
    this.saveColumnState();
  },

  /**
   * Check if column is minimized
   * @param {string} columnId - Column identifier
   * @returns {boolean} True if minimized
   */
  isColumnMinimized(columnId) {
    return this.minimizedColumns.has(columnId);
  },

  /**
   * Set column maximized state
   * @param {string|null} columnId - Column to maximize, or null to clear
   */
  setColumnMaximized(columnId) {
    this.maximizedColumn = columnId;
    this._notifySubscribers('columnState');
    this.saveColumnState();
  },

  /**
   * Get maximized column
   * @returns {string|null} Maximized column ID or null
   */
  getMaximizedColumn() {
    return this.maximizedColumn;
  },

  /**
   * Clear maximized column state
   */
  clearMaximized() {
    this.maximizedColumn = null;
    this._notifySubscribers('columnState');
    this.saveColumnState();
  },

  /**
   * Check if a column is maximized
   * @param {string} columnId - Column identifier
   * @returns {boolean} True if this column is maximized
   */
  isColumnMaximized(columnId) {
    return this.maximizedColumn === columnId;
  },

  /**
   * Check if any column is maximized
   * @returns {boolean} True if any column is maximized
   */
  hasMaximizedColumn() {
    return this.maximizedColumn !== null;
  },

  // ===== Auto-Collapse Methods =====

  /**
   * Check if auto-collapse is enabled for a column
   * @param {string} columnId - Column identifier
   * @returns {boolean} True if auto-collapse is enabled
   */
  isAutoCollapseEnabled(columnId) {
    return this.autoCollapseColumns.has(columnId);
  },

  /**
   * Toggle auto-collapse for a column
   * @param {string} columnId - Column identifier
   * @returns {boolean} New state (true if enabled)
   */
  toggleAutoCollapse(columnId) {
    if (this.autoCollapseColumns.has(columnId)) {
      this.autoCollapseColumns.delete(columnId);
    } else {
      this.autoCollapseColumns.add(columnId);
    }
    this._notifySubscribers('columnState');
    this.saveColumnState();
    return this.autoCollapseColumns.has(columnId);
  },

  /**
   * Disable auto-collapse for a column
   * @param {string} columnId - Column identifier
   */
  disableAutoCollapse(columnId) {
    this.autoCollapseColumns.delete(columnId);
    this.saveColumnState();
  },

  // ===== Task Expansion Methods =====

  /**
   * Check if a task card is expanded
   * @param {string} taskName - Task name
   * @returns {boolean} True if expanded
   */
  isTaskExpanded(taskName) {
    return this.expandedTasks.has(taskName);
  },

  /**
   * Toggle task expansion state
   * @param {string} taskName - Task name
   * @returns {boolean} New state (true if expanded)
   */
  toggleTaskExpanded(taskName) {
    if (this.expandedTasks.has(taskName)) {
      this.expandedTasks.delete(taskName);
    } else {
      this.expandedTasks.add(taskName);
    }
    this._notifySubscribers('taskExpanded', taskName);
    this.saveColumnState();
    return this.expandedTasks.has(taskName);
  },

  /**
   * Set task expansion state
   * @param {string} taskName - Task name
   * @param {boolean} expanded - Whether to expand
   */
  setTaskExpanded(taskName, expanded) {
    if (expanded) {
      this.expandedTasks.add(taskName);
    } else {
      this.expandedTasks.delete(taskName);
    }
    this._notifySubscribers('taskExpanded', taskName);
    this.saveColumnState();
  },

  /**
   * Expand all tasks
   */
  expandAllTasks() {
    const tasks = this.boardData?.tasks || [];
    tasks.forEach((task) => this.expandedTasks.add(task.name));
    this._notifySubscribers('taskExpanded');
    this.saveColumnState();
  },

  /**
   * Collapse all tasks
   */
  collapseAllTasks() {
    this.expandedTasks.clear();
    this._notifySubscribers('taskExpanded');
    this.saveColumnState();
  },

  // ===== localStorage Persistence =====

  /**
   * Save column state to localStorage
   */
  saveColumnState() {
    try {
      const state = {
        minimized: Array.from(this.minimizedColumns),
        maximized: this.maximizedColumn,
        autoCollapse: Array.from(this.autoCollapseColumns),
        expandedTasks: Array.from(this.expandedTasks),
      };
      localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify(state));
    } catch {
      // localStorage not available
    }
  },

  /**
   * Load column state from localStorage
   */
  loadColumnState() {
    try {
      const stored = localStorage.getItem(COLUMN_STATE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        this.minimizedColumns = new Set(state.minimized || []);
        this.maximizedColumn = state.maximized || null;
        this.autoCollapseColumns = new Set(state.autoCollapse || []);
        this.expandedTasks = new Set(state.expandedTasks || []);
      }
    } catch {
      this.minimizedColumns = new Set();
      this.maximizedColumn = null;
      this.autoCollapseColumns = new Set();
      this.expandedTasks = new Set();
    }
  },

  // ===== Subscription Methods =====

  /**
   * Subscribe to state changes
   * @param {Function} callback - Function to call on state change
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  },

  /**
   * Notify all subscribers of state change
   * @param {string} changeType - Type of change that occurred
   */
  _notifySubscribers(changeType) {
    this._subscribers.forEach((callback) => {
      try {
        callback(changeType, this);
      } catch (e) {
        console.error('Board store subscriber error:', e);
      }
    });
  },
};
