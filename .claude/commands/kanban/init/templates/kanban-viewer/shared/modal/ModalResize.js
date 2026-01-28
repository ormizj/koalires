/**
 * ModalResize - 8-direction resize handler for modals
 * Supports n, s, e, w, ne, nw, se, sw resize directions
 */

export class ModalResize {
  /**
   * Create resize handler
   * @param {import('./BaseModal.js').BaseModal} modal - Parent modal instance
   */
  constructor(modal) {
    this.modal = modal;
    this.isResizing = false;
    this.direction = '';
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.modalStartWidth = 0;
    this.modalStartHeight = 0;
    this.modalStartLeft = 0;
    this.modalStartTop = 0;

    // Bind event handlers
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  /**
   * Setup resize event listeners on handles
   * @param {NodeListOf<HTMLElement>|HTMLElement[]} handles - Resize handle elements
   */
  setup(handles) {
    if (!handles) return;

    this.handles = handles;
    handles.forEach((handle) => {
      handle.addEventListener('mousedown', this._onMouseDown);
    });

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  /**
   * Handle mousedown on resize handle
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseDown(e) {
    // Don't resize if maximized
    if (this.modal.isMaximized) return;

    this.isResizing = true;

    // Get resize direction from handle class
    const handle = e.target;
    const classes = handle.className.split(' ');
    this.direction =
      classes
        .find((c) => c.startsWith('resize-') && c !== 'resize-handle')
        ?.replace('resize-', '') || '';

    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;

    const rect = this.modal.element.getBoundingClientRect();
    this.modalStartWidth = rect.width;
    this.modalStartHeight = rect.height;
    this.modalStartLeft = rect.left;
    this.modalStartTop = rect.top;

    e.preventDefault();
  }

  /**
   * Handle mousemove for resizing
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseMove(e) {
    if (!this.isResizing) return;

    const deltaX = e.clientX - this.resizeStartX;
    const deltaY = e.clientY - this.resizeStartY;

    let newWidth = this.modalStartWidth;
    let newHeight = this.modalStartHeight;
    let newLeft = this.modalStartLeft;
    let newTop = this.modalStartTop;

    // Handle horizontal resizing
    if (this.direction.includes('e')) {
      newWidth = Math.max(this.modal.minWidth, this.modalStartWidth + deltaX);
    }
    if (this.direction.includes('w')) {
      const widthDelta = Math.min(
        deltaX,
        this.modalStartWidth - this.modal.minWidth
      );
      newWidth = this.modalStartWidth - widthDelta;
      newLeft = this.modalStartLeft + widthDelta;
    }

    // Handle vertical resizing
    if (this.direction.includes('s')) {
      newHeight = Math.max(
        this.modal.minHeight,
        this.modalStartHeight + deltaY
      );
    }
    if (this.direction.includes('n')) {
      const heightDelta = Math.min(
        deltaY,
        this.modalStartHeight - this.modal.minHeight
      );
      newHeight = this.modalStartHeight - heightDelta;
      newTop = this.modalStartTop + heightDelta;
    }

    // Apply viewport constraints
    const clamped = this._clampPosition(newLeft, newTop, newWidth, newHeight);

    this.modal.element.style.width = `${newWidth}px`;
    this.modal.element.style.height = `${newHeight}px`;
    this.modal.element.style.left = `${clamped.left}px`;
    this.modal.element.style.top = `${clamped.top}px`;
  }

  /**
   * Handle mouseup to end resizing
   */
  _onMouseUp() {
    if (this.isResizing) {
      this.modal.saveSize();
      this.isResizing = false;
      this.direction = '';
    }
  }

  /**
   * Clamp position to keep modal within viewport
   * @param {number} left - Desired left position
   * @param {number} top - Desired top position
   * @param {number} width - Modal width
   * @param {number} height - Modal height
   * @returns {{ left: number, top: number }} Clamped position
   */
  _clampPosition(left, top, width, height) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const clampedLeft = Math.max(0, Math.min(viewportWidth - width, left));
    const clampedTop = Math.max(0, Math.min(viewportHeight - height, top));

    return { left: clampedLeft, top: clampedTop };
  }

  /**
   * Check if currently resizing
   * @returns {boolean} True if resizing
   */
  isActive() {
    return this.isResizing;
  }

  /**
   * Get current resize direction
   * @returns {string} Resize direction (n, s, e, w, ne, nw, se, sw)
   */
  getDirection() {
    return this.direction;
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (this.handles) {
      this.handles.forEach((handle) => {
        handle.removeEventListener('mousedown', this._onMouseDown);
      });
    }
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.handles = null;
  }
}
