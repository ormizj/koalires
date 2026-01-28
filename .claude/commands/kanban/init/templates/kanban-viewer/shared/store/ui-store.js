/**
 * UI Store - Manages UI state (view mode, theme, etc.)
 */

const UI_STATE_KEY = 'kanban-ui-state';

export const uiStore = {
  // View mode: 'board' | 'table'
  viewMode: 'board',

  // Subscribers for state changes
  _subscribers: new Set(),

  /**
   * Get current view mode
   * @returns {string} Current view mode
   */
  getViewMode() {
    return this.viewMode;
  },

  /**
   * Set view mode
   * @param {string} mode - 'board' or 'table'
   */
  setViewMode(mode) {
    if (mode !== 'board' && mode !== 'table') return;
    this.viewMode = mode;
    this._notifySubscribers('viewMode');
    this.saveState();
  },

  /**
   * Toggle view mode between board and table
   * @returns {string} New view mode
   */
  toggleViewMode() {
    this.viewMode = this.viewMode === 'board' ? 'table' : 'board';
    this._notifySubscribers('viewMode');
    this.saveState();
    return this.viewMode;
  },

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = {
        viewMode: this.viewMode,
      };
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
    } catch {
      // localStorage not available
    }
  },

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(UI_STATE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        if (state.viewMode === 'board' || state.viewMode === 'table') {
          this.viewMode = state.viewMode;
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
   */
  _notifySubscribers(changeType) {
    this._subscribers.forEach((callback) => {
      try {
        callback(changeType, this);
      } catch (e) {
        console.error('UI store subscriber error:', e);
      }
    });
  },
};
