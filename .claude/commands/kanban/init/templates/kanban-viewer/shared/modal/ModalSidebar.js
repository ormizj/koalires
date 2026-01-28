/**
 * ModalSidebar - Sidebar collapse/resize behavior for modals
 * Handles sidebar visibility, collapse state, and resizable width
 */

export class ModalSidebar {
  /**
   * Create sidebar handler
   * @param {import('./BaseModal.js').BaseModal} modal - Parent modal instance
   * @param {Object} config - Sidebar configuration
   * @param {number} [config.defaultWidth=200] - Default sidebar width
   * @param {number} [config.minWidth=120] - Minimum sidebar width
   * @param {number} [config.maxWidth=400] - Maximum sidebar width
   * @param {string} [config.stateKey] - localStorage key for persisting state
   */
  constructor(modal, config = {}) {
    this.modal = modal;
    this.element = null;
    this.resizerElement = null;
    this.collapseBtn = null;
    this.expandBtn = null;

    // Configuration
    this.defaultWidth = config.defaultWidth || 200;
    this.minWidth = config.minWidth || 120;
    this.maxWidth = config.maxWidth || 400;
    this.stateKey = config.stateKey || `kanban-${modal.type}-sidebar-state`;

    // State
    this.width = this.defaultWidth;
    this.isCollapsed = false;
    this.isResizing = false;
    this.resizeStartX = 0;
    this.startWidth = 0;

    // Bind event handlers
    this._onCollapseClick = this._onCollapseClick.bind(this);
    this._onExpandClick = this._onExpandClick.bind(this);
    this._onResizerMouseDown = this._onResizerMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  /**
   * Setup sidebar with DOM elements
   * @param {Object} elements - Sidebar DOM elements
   * @param {HTMLElement} elements.sidebar - Main sidebar element
   * @param {HTMLElement} [elements.resizer] - Resize handle element
   * @param {HTMLElement} [elements.collapseBtn] - Collapse button
   * @param {HTMLElement} [elements.expandBtn] - Expand button
   */
  setup(elements) {
    this.element = elements.sidebar;
    this.resizerElement = elements.resizer;
    this.collapseBtn = elements.collapseBtn;
    this.expandBtn = elements.expandBtn;

    if (!this.element) return;

    // Load persisted state
    this.loadState();

    // Setup collapse/expand handlers
    this.collapseBtn?.addEventListener('click', this._onCollapseClick);
    this.expandBtn?.addEventListener('click', this._onExpandClick);

    // Setup resize handlers
    if (this.resizerElement) {
      this.resizerElement.addEventListener(
        'mousedown',
        this._onResizerMouseDown
      );
      document.addEventListener('mousemove', this._onMouseMove);
      document.addEventListener('mouseup', this._onMouseUp);
    }
  }

  /**
   * Show sidebar
   */
  show() {
    if (!this.element) return;

    this.element.classList.remove('hidden');
    this._applyState();
  }

  /**
   * Hide sidebar
   */
  hide() {
    this.element?.classList.add('hidden');
    this.expandBtn?.classList.add('hidden');
    this.resizerElement?.classList.add('hidden');
  }

  /**
   * Toggle collapsed state
   */
  toggle() {
    this.isCollapsed = !this.isCollapsed;
    this._applyState();
    this.saveState();
  }

  /**
   * Collapse sidebar
   */
  collapse() {
    this.isCollapsed = true;
    this._applyState();
    this.saveState();
  }

  /**
   * Expand sidebar
   */
  expand() {
    this.isCollapsed = false;
    this._applyState();
    this.saveState();
  }

  /**
   * Set sidebar width within constraints
   * @param {number} width - Desired width
   */
  setWidth(width) {
    this.width = Math.max(this.minWidth, Math.min(this.maxWidth, width));
    if (!this.isCollapsed && this.element) {
      this.element.style.width = `${this.width}px`;
    }
  }

  /**
   * Get current sidebar width
   * @returns {number} Current width
   */
  getWidth() {
    return this.width;
  }

  /**
   * Check if sidebar is collapsed
   * @returns {boolean} True if collapsed
   */
  getIsCollapsed() {
    return this.isCollapsed;
  }

  /**
   * Check if sidebar is currently being resized
   * @returns {boolean} True if resizing
   */
  isActive() {
    return this.isResizing;
  }

  /**
   * Handle collapse button click
   */
  _onCollapseClick() {
    this.collapse();
  }

  /**
   * Handle expand button click
   */
  _onExpandClick() {
    this.expand();
  }

  /**
   * Start sidebar resize
   * @param {MouseEvent} e - Mouse event
   */
  _onResizerMouseDown(e) {
    this.isResizing = true;
    this.resizeStartX = e.clientX;
    this.startWidth = this.width;

    this.resizerElement?.classList.add('dragging');
    this.element?.classList.add('resizing');

    e.preventDefault();
  }

  /**
   * Handle resize during drag
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseMove(e) {
    if (!this.isResizing) return;

    const deltaX = e.clientX - this.resizeStartX;
    const newWidth = Math.max(
      this.minWidth,
      Math.min(this.maxWidth, this.startWidth + deltaX)
    );

    this.width = newWidth;

    if (this.element) {
      this.element.style.width = `${newWidth}px`;
    }
  }

  /**
   * End sidebar resize
   */
  _onMouseUp() {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.resizerElement?.classList.remove('dragging');
    this.element?.classList.remove('resizing');

    this.saveState();
  }

  /**
   * Apply current state to DOM
   */
  _applyState() {
    if (!this.element) return;

    if (this.isCollapsed) {
      this.element.classList.add('collapsed');
      this.expandBtn?.classList.remove('hidden');
      this.resizerElement?.classList.add('hidden');
    } else {
      this.element.classList.remove('collapsed');
      this.element.style.width = `${this.width}px`;
      this.expandBtn?.classList.add('hidden');
      this.resizerElement?.classList.remove('hidden');
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(this.stateKey);
      if (stored) {
        const state = JSON.parse(stored);
        this.isCollapsed = state.collapsed || false;
        this.width = Math.max(
          this.minWidth,
          Math.min(this.maxWidth, state.width || this.defaultWidth)
        );
      }
    } catch {
      this.isCollapsed = false;
      this.width = this.defaultWidth;
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      localStorage.setItem(
        this.stateKey,
        JSON.stringify({
          collapsed: this.isCollapsed,
          width: this.width,
        })
      );
    } catch {
      // localStorage not available
    }
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    this.collapseBtn?.removeEventListener('click', this._onCollapseClick);
    this.expandBtn?.removeEventListener('click', this._onExpandClick);

    if (this.resizerElement) {
      this.resizerElement.removeEventListener(
        'mousedown',
        this._onResizerMouseDown
      );
    }

    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);

    this.element = null;
    this.resizerElement = null;
    this.collapseBtn = null;
    this.expandBtn = null;
  }
}
