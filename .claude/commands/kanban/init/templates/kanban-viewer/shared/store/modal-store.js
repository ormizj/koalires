/**
 * Modal Store - Manages modal state with focus-based model
 * Only one modal can be focused (visible) at a time
 */

const MODAL_STATE_KEY = 'kanban-modal-state';

export const modalStore = {
  // Modal states: { id: { isMaximized, position, size, type, openedAt, displayInfo } }
  modals: new Map(),

  // Currently focused modal ID (only one can be focused at a time)
  focusedModalId: null,

  // Taskbar collapsed state
  _taskbarCollapsed: false,

  // Subscribers for state changes
  _subscribers: new Set(),

  /**
   * Register a modal and focus it
   * @param {string} id - Modal ID
   * @param {string} type - Modal type ('metadata' | 'task')
   * @param {Object} config - Modal configuration
   * @returns {number} openedAt timestamp
   */
  registerModal(id, type, config = {}) {
    const openedAt = Date.now();
    this.modals.set(id, {
      isMaximized: false,
      position: null,
      size: null,
      type: type || 'default',
      openedAt,
      displayInfo: {},
      ...config,
    });
    // Auto-focus the newly registered modal
    this.focusModal(id);
    return openedAt;
  },

  /**
   * Unregister (remove) a modal from the store
   * @param {string} id - Modal ID
   */
  unregisterModal(id) {
    if (this.modals.has(id)) {
      // Clear focus if this modal was focused
      if (this.focusedModalId === id) {
        this.focusedModalId = null;
      }
      this.modals.delete(id);
      this._notifySubscribers('unregister', id);
    }
  },

  /**
   * Get modal state
   * @param {string} id - Modal ID
   * @returns {Object|null} Modal state
   */
  getModal(id) {
    return this.modals.get(id) || null;
  },

  /**
   * Focus a modal (make it visible, auto-unfocuses any other focused modal)
   * @param {string} id - Modal ID
   * @param {Object} options - Focus options (taskName, position, etc.)
   */
  focusModal(id, options = {}) {
    const modal = this.modals.get(id);
    if (!modal) return;

    // Update focused modal ID (this unfocuses any previously focused modal)
    this.focusedModalId = id;

    if (options.taskName !== undefined) modal.taskName = options.taskName;
    if (options.position) modal.position = options.position;
    if (options.size) modal.size = options.size;

    this._notifySubscribers('focus', id);
    this.saveState();
  },

  /**
   * Unfocus a modal (hide it but keep in taskbar)
   * @param {string} id - Modal ID
   * @param {Object} displayInfo - Info for taskbar display
   */
  unfocusModal(id, displayInfo = {}) {
    const modal = this.modals.get(id);
    if (!modal) return;

    // Only unfocus if this modal is currently focused
    if (this.focusedModalId === id) {
      this.focusedModalId = null;
    }

    modal.displayInfo = { ...displayInfo };

    // Merge displayInfo properties into modal for easy access
    if (displayInfo.title) modal.title = displayInfo.title;
    if (displayInfo.mode) modal.mode = displayInfo.mode;
    if (displayInfo.columnId) modal.columnId = displayInfo.columnId;
    if (displayInfo.taskNames) modal.taskNames = displayInfo.taskNames;
    if (displayInfo.taskName) modal.taskName = displayInfo.taskName;

    this._notifySubscribers('unfocus', id);
    this.saveState();
  },

  /**
   * Get the currently focused modal
   * @returns {Object|null} Focused modal info with id, or null if none focused
   */
  getFocusedModal() {
    if (!this.focusedModalId) return null;
    const modal = this.modals.get(this.focusedModalId);
    return modal ? { id: this.focusedModalId, ...modal } : null;
  },

  /**
   * Check if a modal is focused
   * @param {string} id - Modal ID
   * @returns {boolean} True if the modal is focused
   */
  isFocused(id) {
    return this.focusedModalId === id;
  },

  /**
   * Restore a modal from unfocused state (focus it again)
   * @param {string} id - Modal ID
   * @returns {Object|null} Modal info for restoration
   */
  restoreModal(id) {
    const modal = this.modals.get(id);
    if (!modal) return null;

    // Focus the modal
    this.focusModal(id);

    // Return info needed for restoration
    return {
      openedAt: modal.openedAt,
      title: modal.title,
      mode: modal.mode,
      columnId: modal.columnId,
      taskNames: modal.taskNames,
      taskName: modal.taskName,
      ...modal.displayInfo,
    };
  },

  /**
   * Toggle maximized state
   * @param {string} id - Modal ID
   */
  toggleMaximize(id) {
    const modal = this.modals.get(id);
    if (!modal) return;

    modal.isMaximized = !modal.isMaximized;

    this._notifySubscribers('maximize', id);
    this.saveState();
  },

  /**
   * Update modal position
   * @param {string} id - Modal ID
   * @param {Object} position - { x, y }
   */
  updatePosition(id, position) {
    const modal = this.modals.get(id);
    if (!modal) return;

    modal.position = position;
    this.saveState();
  },

  /**
   * Update modal size
   * @param {string} id - Modal ID
   * @param {Object} size - { width, height }
   */
  updateSize(id, size) {
    const modal = this.modals.get(id);
    if (!modal) return;

    modal.size = size;
    this.saveState();
  },

  /**
   * Check if any modals are registered
   * @returns {boolean}
   */
  hasAnyModals() {
    return this.modals.size > 0;
  },

  /**
   * Get all modals sorted by openedAt timestamp with focus state
   * @returns {Array} Array of { id, isFocused, ...modalState } objects
   */
  getAllModalsSorted() {
    return Array.from(this.modals.entries())
      .map(([id, state]) => ({
        id,
        isFocused: this.focusedModalId === id,
        ...state,
      }))
      .sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0));
  },

  /**
   * Get taskbar collapsed state
   * @returns {boolean}
   */
  getTaskbarCollapsed() {
    return this._taskbarCollapsed;
  },

  /**
   * Toggle taskbar collapsed state
   */
  toggleTaskbar() {
    this._taskbarCollapsed = !this._taskbarCollapsed;
    this._notifySubscribers('taskbarToggle', null);
  },

  /**
   * Get all focused modals (there can be at most one)
   * @returns {Array} Array of [id, state] pairs
   */
  getFocusedModals() {
    if (!this.focusedModalId) return [];
    const modal = this.modals.get(this.focusedModalId);
    return modal ? [[this.focusedModalId, modal]] : [];
  },

  /**
   * Get all unfocused modals
   * @returns {Array} Array of [id, state] pairs
   */
  getUnfocusedModals() {
    return Array.from(this.modals.entries()).filter(
      ([id]) => id !== this.focusedModalId
    );
  },

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = {};
      this.modals.forEach((modal, id) => {
        if (modal.position || modal.size) {
          state[id] = {
            position: modal.position,
            size: modal.size,
          };
        }
      });
      localStorage.setItem(MODAL_STATE_KEY, JSON.stringify(state));
    } catch {
      // localStorage not available
    }
  },

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(MODAL_STATE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        Object.entries(state).forEach(([id, data]) => {
          const modal = this.modals.get(id);
          if (modal) {
            if (data.position) modal.position = data.position;
            if (data.size) modal.size = data.size;
          }
        });
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
   * @param {string} modalId - ID of modal that changed
   */
  _notifySubscribers(changeType, modalId) {
    this._subscribers.forEach((callback) => {
      try {
        callback(changeType, modalId, this.modals.get(modalId));
      } catch (e) {
        console.error('Modal store subscriber error:', e);
      }
    });
  },
};
