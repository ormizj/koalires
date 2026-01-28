/**
 * Table Store - Manages table expansion state
 */

const TABLE_STATE_KEY = 'kanban-table-expanded-rows';

export const tableStore = {
  // Set of expanded task names
  expandedRows: new Set(),

  // Subscribers for state changes
  _subscribers: new Set(),

  /**
   * Check if a row is expanded
   * @param {string} taskName - Task name to check
   * @returns {boolean} Whether the row is expanded
   */
  isRowExpanded(taskName) {
    return this.expandedRows.has(taskName);
  },

  /**
   * Toggle row expansion state
   * @param {string} taskName - Task name to toggle
   * @returns {boolean} New expansion state
   */
  toggleRowExpanded(taskName) {
    if (this.expandedRows.has(taskName)) {
      this.expandedRows.delete(taskName);
    } else {
      this.expandedRows.add(taskName);
    }
    this._notifySubscribers('rowExpanded', taskName);
    this.saveState();
    return this.expandedRows.has(taskName);
  },

  /**
   * Set row expansion state
   * @param {string} taskName - Task name
   * @param {boolean} expanded - Whether to expand
   */
  setRowExpanded(taskName, expanded) {
    if (expanded) {
      this.expandedRows.add(taskName);
    } else {
      this.expandedRows.delete(taskName);
    }
    this._notifySubscribers('rowExpanded', taskName);
    this.saveState();
  },

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = Array.from(this.expandedRows);
      localStorage.setItem(TABLE_STATE_KEY, JSON.stringify(state));
    } catch {
      // localStorage not available
    }
  },

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(TABLE_STATE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        if (Array.isArray(state)) {
          this.expandedRows = new Set(state);
        }
      }
    } catch {
      // localStorage not available
    }
  },

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
   * @param {string} changeType - Type of change
   * @param {any} data - Additional data
   */
  _notifySubscribers(changeType, data) {
    this._subscribers.forEach((callback) => {
      try {
        callback(changeType, data, this);
      } catch (e) {
        console.error('Table store subscriber error:', e);
      }
    });
  },
};
