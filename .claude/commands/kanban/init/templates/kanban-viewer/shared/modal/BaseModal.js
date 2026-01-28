/**
 * BaseModal - Core modal class with drag, resize, minimize/maximize functionality
 * Provides shared behavior for all modal types in the kanban-viewer
 */

import { modalStore } from '../store/index.js';
import { ModalDrag } from './ModalDrag.js';
import { ModalResize } from './ModalResize.js';
import { ModalSidebar } from './ModalSidebar.js';

export class BaseModal {
  /**
   * Create a base modal instance
   * @param {Object} config - Modal configuration
   * @param {string} config.id - Unique modal identifier
   * @param {HTMLElement} config.element - Modal DOM element
   * @param {HTMLElement} config.overlay - Overlay DOM element
   * @param {string} config.type - Modal type ('metadata' | 'task')
   * @param {number} [config.minWidth=500] - Minimum modal width
   * @param {number} [config.minHeight=400] - Minimum modal height
   * @param {number} [config.defaultWidth=700] - Default modal width
   * @param {number} [config.defaultHeight=600] - Default modal height
   * @param {string} [config.sizeKey] - localStorage key for size persistence
   * @param {string} [config.fullscreenKey] - localStorage key for fullscreen state
   * @param {Object} [config.sidebarConfig] - Sidebar configuration (if sidebar enabled)
   * @param {Object} [config.selectors] - CSS selectors for modal elements
   */
  constructor(config) {
    this.id = config.id;
    this.element = config.element;
    this.overlay = config.overlay;
    this.type = config.type;

    // Size constraints
    this.minWidth = config.minWidth || 500;
    this.minHeight = config.minHeight || 400;
    this.defaultWidth = config.defaultWidth || 700;
    this.defaultHeight = config.defaultHeight || 600;

    // localStorage keys
    this.sizeKey = config.sizeKey || `kanban-${this.type}-modal-size`;
    this.fullscreenKey =
      config.fullscreenKey || `kanban-${this.type}-modal-fullscreen`;

    // CSS selectors for modal elements (can be customized per modal type)
    this.selectors = {
      header: config.selectors?.header || '.modal-header',
      title: config.selectors?.title || '.modal-title',
      close: config.selectors?.close || '.modal-close',
      minimize: config.selectors?.minimize || '.modal-minimize',
      maximize: config.selectors?.maximize || '.modal-maximize',
      resizeHandles: config.selectors?.resizeHandles || '.resize-handle',
      ...config.selectors,
    };

    // State
    this.isMaximized = false;
    this.isVisible = false;
    this.preMaximizeState = { width: 0, height: 0, left: 0, top: 0 };
    this._currentKey = null; // Current modal key for store tracking
    this._openedAt = null; // Timestamp when modal was opened
    this._storeUnsubscribe = null; // Store subscription cleanup

    // Initialize behavior handlers
    this.drag = new ModalDrag(this);
    this.resize = new ModalResize(this);
    this.sidebar = config.sidebarConfig
      ? new ModalSidebar(this, config.sidebarConfig)
      : null;

    // Bind event handlers
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onOverlayClick = this._onOverlayClick.bind(this);
    this._onWindowResize = this._onWindowResize.bind(this);
    this._onStoreChange = this._onStoreChange.bind(this);
  }

  /**
   * Initialize modal with event listeners
   * Call after constructor to setup drag/resize/buttons
   */
  init() {
    if (!this.element || !this.overlay) return;

    // Setup drag on header
    const header = this.element.querySelector(this.selectors.header);
    if (header) {
      this.drag.setup(header);

      // Double-click header to maximize
      header.addEventListener('dblclick', (e) => {
        const closeBtn = this.element.querySelector(this.selectors.close);
        const maximizeBtn = this.element.querySelector(this.selectors.maximize);
        const minimizeBtn = this.element.querySelector(this.selectors.minimize);

        if (
          !e.target.closest(this.selectors.close) &&
          !e.target.closest(this.selectors.maximize) &&
          !e.target.closest(this.selectors.minimize)
        ) {
          this.toggleMaximize();
        }
      });
    }

    // Setup resize handles
    const resizeHandles = this.element.querySelectorAll(
      this.selectors.resizeHandles
    );
    this.resize.setup(resizeHandles);

    // Setup control buttons
    this._setupControlButtons();

    // Global event listeners
    window.addEventListener('resize', this._onWindowResize);

    // Subscribe to store changes to auto-hide when focus moves elsewhere
    this._storeUnsubscribe = modalStore.subscribe(this._onStoreChange);
  }

  /**
   * Setup control button event listeners
   */
  _setupControlButtons() {
    // Close button
    const closeBtn = this.element.querySelector(this.selectors.close);
    closeBtn?.addEventListener('click', () => this.hide());

    // Minimize button
    const minimizeBtn = this.element.querySelector(this.selectors.minimize);
    minimizeBtn?.addEventListener('click', () => this.minimize());

    // Maximize button
    const maximizeBtn = this.element.querySelector(this.selectors.maximize);
    maximizeBtn?.addEventListener('click', () => this.toggleMaximize());
  }

  /**
   * Setup overlay and escape key listeners (call when showing modal)
   */
  _setupEventListeners() {
    document.addEventListener('keydown', this._onKeyDown);
    this.overlay?.addEventListener('click', this._onOverlayClick);
  }

  /**
   * Remove overlay and escape key listeners (call when hiding modal)
   */
  _removeEventListeners() {
    document.removeEventListener('keydown', this._onKeyDown);
    this.overlay?.removeEventListener('click', this._onOverlayClick);
  }

  // ===== Core Methods =====

  /**
   * Show the modal
   * @param {Object} options - Show options
   * @param {string} [options.key] - Unique key for this modal instance
   * @param {string} [options.title] - Modal title to display
   * @param {number} [options.openedAt] - Preserved openedAt timestamp (for restore)
   * @param {Object} [options.displayInfo] - Additional display info for taskbar
   */
  show(options = {}) {
    if (!this.element || !this.overlay) return;

    const key = options.key || this.id;

    // Note: We intentionally do NOT unregister the previous key here.
    // This allows multiple entries per modal type to coexist in the taskbar
    // (e.g., a column entry and a single task entry for the same modal).
    // Cleanup happens only in hide() when explicitly closing.

    this._currentKey = key;

    // Store displayInfo for use during auto-hide (when focus moves to another modal)
    this._currentDisplayInfo = {
      title: options.title,
      ...options.displayInfo,
    };

    // Register with modal store - pass title and displayInfo so taskbar shows correct info immediately
    // Check if modal already exists to preserve openedAt timestamp (prevents tab position change)
    const existingModal = modalStore.getModal(key);
    if (existingModal) {
      // Modal exists - focus it and preserve original timestamp
      modalStore.focusModal(key);
      this._openedAt = existingModal.openedAt;
    } else {
      // New modal - register it
      this._openedAt = modalStore.registerModal(
        key,
        this.type,
        this._currentDisplayInfo
      );
    }

    // Update title if provided
    if (options.title) {
      const titleEl = this.element.querySelector(this.selectors.title);
      if (titleEl) {
        titleEl.textContent = options.title;
      }
    }

    // Show overlay and modal
    this.overlay.classList.remove('hidden');
    this.isVisible = true;

    // Disable body scroll
    document.body.style.overflow = 'hidden';

    // Reset modal position to center
    this.center();

    // Apply fullscreen state if preference is set
    this._applyFullscreenState();

    // Setup event listeners
    this._setupEventListeners();
  }

  /**
   * Hide the modal
   */
  hide() {
    if (!this.element || !this.overlay) return;

    // Reset maximize state (visual only, preference preserved)
    if (this.isMaximized) {
      this.element.classList.remove('maximized');
      this.isMaximized = false;
      this._updateMaximizeIcon(false);
    }

    this.overlay.classList.add('hidden');
    this.isVisible = false;

    // Restore body scroll
    document.body.style.overflow = '';

    // Remove event listeners
    this._removeEventListeners();

    // Unregister from modal store
    if (this._currentKey) {
      modalStore.unregisterModal(this._currentKey);
      this._currentKey = null;
      this._openedAt = null;
    }
  }

  /**
   * Minimize (unfocus) modal to taskbar
   * @param {Object} [displayInfo] - Info for taskbar display
   * @param {string} [displayInfo.title] - Title to show in taskbar
   * @param {string} [displayInfo.mode] - Mode ('single' | 'column')
   * @param {string} [displayInfo.columnId] - Column ID if column mode
   * @param {string[]} [displayInfo.taskNames] - Task names if column mode
   * @param {string} [displayInfo.taskName] - Current task name
   */
  minimize(displayInfo = {}) {
    if (!this._currentKey || !this.element || !this.overlay) return;

    // Unfocus in store
    modalStore.unfocusModal(this._currentKey, displayInfo);

    // Hide modal visually
    this._hideVisually();
  }

  /**
   * Restore modal from unfocused state (focus it again)
   * @param {Object} [options] - Restore options
   * @param {number} [options.openedAt] - Preserved openedAt timestamp
   * @returns {Object|null} Restored info from store
   */
  restore(options = {}) {
    const info = modalStore.restoreModal(this._currentKey);
    if (!info) return null;

    // Show modal visually (store already focused it)
    this._showVisually(info.openedAt);

    return info;
  }

  /**
   * Show modal visually (called when focus is restored)
   * @param {number} [openedAt] - Preserved openedAt timestamp
   */
  _showVisually(openedAt) {
    if (!this.element || !this.overlay) return;

    // Show overlay and modal
    this.overlay.classList.remove('hidden');
    this.isVisible = true;

    // Disable body scroll
    document.body.style.overflow = 'hidden';

    // Reset modal position to center if not already positioned
    this.center();

    // Apply fullscreen state if preference is set
    this._applyFullscreenState();

    // Setup event listeners
    this._setupEventListeners();
  }

  /**
   * Toggle maximize/restore state
   */
  toggleMaximize() {
    if (!this.element) return;

    if (this.isMaximized) {
      // Restore
      this.element.classList.remove('maximized');
      this.element.style.width = `${this.preMaximizeState.width}px`;
      this.element.style.height = `${this.preMaximizeState.height}px`;
      this.element.style.left = `${this.preMaximizeState.left}px`;
      this.element.style.top = `${this.preMaximizeState.top}px`;

      this._updateMaximizeIcon(false);
    } else {
      // Save current state
      const rect = this.element.getBoundingClientRect();
      this.preMaximizeState = {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
      };

      // Maximize
      this.element.classList.add('maximized');
      this._updateMaximizeIcon(true);
    }

    this.isMaximized = !this.isMaximized;
    this._saveFullscreenState(this.isMaximized);
  }

  /**
   * Center modal on screen
   */
  center() {
    if (!this.element) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const size = this.loadSize();

    this.element.style.width = `${size.width}px`;
    this.element.style.height = `${size.height}px`;
    this.element.style.left = `${(viewportWidth - size.width) / 2}px`;
    this.element.style.top = `${(viewportHeight - size.height) / 2}px`;
  }

  // ===== Size Management =====

  /**
   * Save modal size to localStorage
   */
  saveSize() {
    if (!this.element) return;

    const size = {
      width: this.element.offsetWidth,
      height: this.element.offsetHeight,
    };

    try {
      localStorage.setItem(this.sizeKey, JSON.stringify(size));
    } catch {
      // localStorage not available
    }
  }

  /**
   * Load modal size from localStorage
   * @returns {{ width: number, height: number }} Loaded size
   */
  loadSize() {
    try {
      const stored = localStorage.getItem(this.sizeKey);
      if (stored) {
        const size = JSON.parse(stored);
        return {
          width: Math.max(this.minWidth, size.width || this.defaultWidth),
          height: Math.max(this.minHeight, size.height || this.defaultHeight),
        };
      }
    } catch {
      // localStorage not available
    }
    return { width: this.defaultWidth, height: this.defaultHeight };
  }

  /**
   * Save fullscreen state to localStorage
   * @param {boolean} isFullscreen - Whether modal is fullscreen
   */
  _saveFullscreenState(isFullscreen) {
    try {
      localStorage.setItem(this.fullscreenKey, isFullscreen ? 'true' : 'false');
    } catch {
      // localStorage not available
    }
  }

  /**
   * Load fullscreen state from localStorage
   * @returns {boolean} Whether modal should be fullscreen
   */
  _loadFullscreenState() {
    try {
      return localStorage.getItem(this.fullscreenKey) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Apply fullscreen state on modal open
   */
  _applyFullscreenState() {
    const shouldBeFullscreen = this._loadFullscreenState();

    if (shouldBeFullscreen) {
      // Save pre-maximize state if not already maximized
      if (!this.isMaximized) {
        const rect = this.element.getBoundingClientRect();
        this.preMaximizeState = {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
        };
      }

      // Always ensure maximized class and state are applied
      // (handles case where isMaximized=true but class was removed during _hideVisually)
      this.element.classList.add('maximized');
      this.isMaximized = true;
      this._updateMaximizeIcon(true);
    } else if (this.isMaximized) {
      this.element.classList.remove('maximized');
      this.isMaximized = false;
      this._updateMaximizeIcon(false);
    }
  }

  // ===== Event Handlers =====

  /**
   * Handle escape key to close modal
   * @param {KeyboardEvent} e - Keyboard event
   */
  _onKeyDown(e) {
    if (e.key === 'Escape' && this.isVisible) {
      this.hide();
    }
  }

  /**
   * Handle click on overlay to minimize
   * @param {MouseEvent} e - Mouse event
   */
  _onOverlayClick(e) {
    if (e.target === this.overlay) {
      this.minimize();
    }
  }

  /**
   * Handle window resize
   */
  _onWindowResize() {
    if (!this.element || !this.isVisible) return;

    if (this.isMaximized) {
      // Already maximized, CSS handles it
      return;
    }

    // Re-clamp position if modal is outside viewport
    const rect = this.element.getBoundingClientRect();
    const clamped = this.drag.clampPosition(
      rect.left,
      rect.top,
      rect.width,
      rect.height
    );

    if (clamped.left !== rect.left || clamped.top !== rect.top) {
      this.element.style.left = `${clamped.left}px`;
      this.element.style.top = `${clamped.top}px`;
    }
  }

  /**
   * Handle modal store changes - auto-hide when focus moves elsewhere
   * @param {string} changeType - Type of change
   * @param {string} modalId - ID of modal that changed
   */
  _onStoreChange(changeType, modalId) {
    // When another modal gains focus, hide this modal if it's visible
    if (
      changeType === 'focus' &&
      this._currentKey &&
      modalId !== this._currentKey
    ) {
      if (this.isVisible) {
        // Store displayInfo before hiding so taskbar can restore properly
        modalStore.unfocusModal(
          this._currentKey,
          this._currentDisplayInfo || {}
        );
        this._hideVisually();
      }
    }
  }

  /**
   * Hide modal visually without unregistering from store
   * Used when focus moves to another modal
   */
  _hideVisually() {
    if (!this.element || !this.overlay) return;

    // Remove maximized CSS class for clean hide (state preserved for restore)
    if (this.isMaximized) {
      this.element.classList.remove('maximized');
      // Note: Don't reset isMaximized or update icon - state preserved for restore
    }

    this.overlay.classList.add('hidden');
    this.isVisible = false;

    // Restore body scroll
    document.body.style.overflow = '';

    // Remove event listeners
    this._removeEventListeners();
  }

  /**
   * Update maximize button icon
   * @param {boolean} isMaximizedState - Whether modal is maximized
   */
  _updateMaximizeIcon(isMaximizedState) {
    const btn = this.element?.querySelector(this.selectors.maximize);
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

  // ===== Utility Methods =====

  /**
   * Get current modal key
   * @returns {string|null} Current modal key
   */
  getCurrentKey() {
    return this._currentKey;
  }

  /**
   * Get opened timestamp
   * @returns {number|null} Opened timestamp
   */
  getOpenedAt() {
    return this._openedAt;
  }

  /**
   * Check if modal is visible
   * @returns {boolean} True if visible
   */
  getIsVisible() {
    return this.isVisible;
  }

  /**
   * Check if modal is maximized
   * @returns {boolean} True if maximized
   */
  getIsMaximized() {
    return this.isMaximized;
  }

  /**
   * Setup sidebar with DOM elements
   * @param {Object} elements - Sidebar DOM elements
   */
  setupSidebar(elements) {
    this.sidebar?.setup(elements);
  }

  /**
   * Cleanup all event listeners and handlers
   */
  destroy() {
    this._removeEventListeners();
    window.removeEventListener('resize', this._onWindowResize);

    // Unsubscribe from store
    if (this._storeUnsubscribe) {
      this._storeUnsubscribe();
      this._storeUnsubscribe = null;
    }

    this.drag.destroy();
    this.resize.destroy();
    this.sidebar?.destroy();

    if (this._currentKey) {
      modalStore.unregisterModal(this._currentKey);
    }

    this.element = null;
    this.overlay = null;
  }
}
