/**
 * ModalTaskbar - Taskbar integration for modal management
 * Manages rendering and interaction of focused/unfocused modal items in the taskbar
 */

import { modalStore } from '../store/index.js';

/**
 * Icons for modal types and modes
 */
const ICONS = {
  // Metadata modal type icon (search/magnifying glass)
  metadata: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`,

  // Task modal type icon (clipboard)
  task: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
  </svg>`,

  // Column mode icon (kanban board)
  column: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
    <rect x="3" y="3" width="5" height="18" rx="1" />
    <rect x="10" y="3" width="5" height="12" rx="1" />
    <rect x="17" y="3" width="4" height="15" rx="1" />
  </svg>`,

  // Single task mode icon (file)
  single: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>`,
};

export class ModalTaskbar {
  constructor() {
    this.element = null;
    this.toggleElement = null;
    this._unsubscribe = null;
    this._restoreCallbacks = new Map(); // type -> callback(id, info)
    this._closeCallbacks = new Map(); // type -> callback(id, isOpen)
    this._minimizeCallbacks = new Map(); // type -> callback(id)
  }

  /**
   * Initialize taskbar with DOM elements and store subscription
   * @param {Object} [elements] - Taskbar DOM elements
   * @param {HTMLElement} [elements.container] - Taskbar container element
   * @param {HTMLElement} [elements.toggle] - Toggle arrow element
   * @param {HTMLElement} [elements.divider] - Divider element
   */
  setup(elements = {}) {
    this.element =
      elements.container || document.getElementById('taskbar-modals');
    this.toggleElement =
      elements.toggle || document.getElementById('taskbar-toggle');
    this.dividerElement =
      elements.divider || document.getElementById('status-divider');

    if (!this.element) return;

    // Subscribe to modal store changes
    this._unsubscribe = modalStore.subscribe((event) => {
      this.render();
    });

    // Setup toggle button
    if (this.toggleElement) {
      this.toggleElement.addEventListener('click', () => {
        modalStore.toggleTaskbar();
        this._updateToggleState();
      });
      this._updateToggleState();
    }

    // Initial render
    this.render();
  }

  /**
   * Register callback for restoring modals of a specific type
   * @param {string} type - Modal type ('metadata' | 'task')
   * @param {Function} callback - Restore callback (id, info) => void
   */
  registerRestoreCallback(type, callback) {
    this._restoreCallbacks.set(type, callback);
  }

  /**
   * Register callback for closing modals of a specific type
   * @param {string} type - Modal type ('metadata' | 'task')
   * @param {Function} callback - Close callback (id, isOpen) => void
   */
  registerCloseCallback(type, callback) {
    this._closeCallbacks.set(type, callback);
  }

  /**
   * Register callback for minimizing modals of a specific type
   * @param {string} type - Modal type ('metadata' | 'task')
   * @param {Function} callback - Minimize callback (id) => void
   */
  registerMinimizeCallback(type, callback) {
    this._minimizeCallbacks.set(type, callback);
  }

  /**
   * Render all modal items in taskbar
   */
  render() {
    if (!this.element) return;

    // Clear existing items
    this.element.innerHTML = '';

    const hasAnyModals = modalStore.hasAnyModals();
    const isCollapsed = modalStore.getTaskbarCollapsed();

    // Update visibility
    this.updateVisibility(hasAnyModals);

    // Apply collapsed state
    this.element.classList.toggle('collapsed', isCollapsed && hasAnyModals);

    if (!hasAnyModals) return;

    // Get all modals sorted by openedAt
    const allModals = modalStore.getAllModalsSorted();

    // Render each modal
    allModals.forEach((modalInfo) => {
      const item = this._createModalItem(modalInfo.id, modalInfo);
      this.element.appendChild(item);
    });
  }

  /**
   * Create a taskbar item for a modal
   * @param {string} id - Modal identifier
   * @param {Object} info - Modal info (includes isFocused from getAllModalsSorted)
   * @returns {HTMLElement} Taskbar item element
   */
  _createModalItem(id, info) {
    const item = document.createElement('button');
    item.className = info.isFocused
      ? 'focused-modal-item'
      : 'unfocused-modal-item';
    item.dataset.modalType = info.type;
    item.dataset.modalId = id;
    item.style.order = info.openedAt || 0;

    // Display name - strip Task:/Metadata:/Column: prefixes
    const displayName =
      info.title?.replace(/^(Task|Metadata|Column):\s*/i, '') || id;
    item.title = info.isFocused
      ? `${info.title || id} (Focused)`
      : info.title || id;

    // Type icon (metadata search or task clipboard)
    const typeIconSpan = document.createElement('span');
    typeIconSpan.className = info.isFocused
      ? `focused-modal-icon type-icon ${info.type}-type`
      : `unfocused-modal-icon type-icon ${info.type}-type`;
    typeIconSpan.innerHTML = ICONS[info.type] || ICONS.task;
    typeIconSpan.title =
      info.type === 'metadata' ? 'Metadata View' : 'Task View';

    // Mode icon (column or single)
    const modeIconSpan = document.createElement('span');
    modeIconSpan.className = info.isFocused
      ? 'focused-modal-icon'
      : 'unfocused-modal-icon';
    if (info.mode === 'column') {
      modeIconSpan.innerHTML = ICONS.column;
      modeIconSpan.title = 'Column Mode';
    } else {
      modeIconSpan.innerHTML = ICONS.single;
      modeIconSpan.title = 'Single Task';
    }

    // Separator after icons
    const iconSeparator = document.createElement('span');
    iconSeparator.className = info.isFocused
      ? 'focused-modal-separator'
      : 'unfocused-modal-separator';

    // Name span
    const nameSpan = document.createElement('span');
    nameSpan.className = info.isFocused
      ? 'focused-modal-name'
      : 'unfocused-modal-name';
    nameSpan.textContent = displayName;

    // Separator before close
    const separator = document.createElement('span');
    separator.className = info.isFocused
      ? 'focused-modal-separator'
      : 'unfocused-modal-separator';

    // Close button
    const closeBtn = document.createElement('span');
    closeBtn.className = info.isFocused
      ? 'focused-modal-close'
      : 'unfocused-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onCloseClick(id, info);
    });

    // Build item
    item.appendChild(typeIconSpan);
    item.appendChild(modeIconSpan);
    item.appendChild(iconSeparator);
    item.appendChild(nameSpan);
    item.appendChild(separator);
    item.appendChild(closeBtn);

    // Click handler - toggle focus
    item.addEventListener('click', () => this._onModalClick(id, info));

    return item;
  }

  /**
   * Handle click on modal item - toggle focus
   * @param {string} id - Modal identifier
   * @param {Object} info - Modal info
   */
  _onModalClick(id, info) {
    if (info.isFocused) {
      // Minimize (unfocus but keep in taskbar)
      const callback = this._minimizeCallbacks.get(info.type);
      if (callback) {
        callback(id);
      }
    } else {
      // Restore (focus the unfocused modal)
      const callback = this._restoreCallbacks.get(info.type);
      if (callback) {
        const restored = modalStore.restoreModal(id);
        callback(id, restored);
      }
    }
  }

  /**
   * Handle click on close button
   * @param {string} id - Modal identifier
   * @param {Object} info - Modal info
   */
  _onCloseClick(id, info) {
    const callback = this._closeCallbacks.get(info.type);
    if (callback) {
      callback(id, info.isFocused);
    } else {
      // Default behavior: just unregister
      modalStore.unregisterModal(id);
    }
    this.render();
  }

  /**
   * Update toggle button state
   */
  _updateToggleState() {
    if (!this.toggleElement) return;

    const isCollapsed = modalStore.getTaskbarCollapsed();
    this.toggleElement.classList.toggle('collapsed', isCollapsed);
    this.toggleElement.classList.toggle('expanded', !isCollapsed);
  }

  /**
   * Update visibility of taskbar elements
   * @param {boolean} hasModals - Whether there are any modals
   */
  updateVisibility(hasModals = modalStore.hasAnyModals()) {
    if (this.dividerElement) {
      this.dividerElement.style.display = hasModals ? 'block' : 'none';
    }

    if (this.toggleElement) {
      this.toggleElement.style.display = hasModals ? 'flex' : 'none';
    }

    this.element?.classList.toggle('hidden', !hasModals);
  }

  /**
   * Force re-render of taskbar
   */
  refresh() {
    this.render();
  }

  /**
   * Cleanup and unsubscribe
   */
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    this._restoreCallbacks.clear();
    this._closeCallbacks.clear();
    this._minimizeCallbacks.clear();
    this.element = null;
    this.toggleElement = null;
    this.dividerElement = null;
  }
}

// Singleton instance for global taskbar management
export const taskbar = new ModalTaskbar();
