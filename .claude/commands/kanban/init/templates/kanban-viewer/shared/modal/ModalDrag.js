/**
 * ModalDrag - Drag behavior handler for modals
 * Handles dragging modal by header with viewport clamping
 */

export class ModalDrag {
  /**
   * Create drag handler
   * @param {import('./BaseModal.js').BaseModal} modal - Parent modal instance
   */
  constructor(modal) {
    this.modal = modal;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.modalStartX = 0;
    this.modalStartY = 0;

    // Bind event handlers
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  /**
   * Setup drag event listeners
   * @param {HTMLElement} dragHandle - Element to use as drag handle (usually header)
   */
  setup(dragHandle) {
    if (!dragHandle) return;

    this.dragHandle = dragHandle;
    dragHandle.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  /**
   * Handle mousedown on drag handle
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseDown(e) {
    // Don't drag if maximized
    if (this.modal.isMaximized) return;

    // Don't drag if clicking control buttons
    if (
      e.target.closest('.modal-close') ||
      e.target.closest('.modal-maximize') ||
      e.target.closest('.modal-minimize') ||
      e.target.closest('.task-modal-close') ||
      e.target.closest('.task-modal-maximize') ||
      e.target.closest('.task-modal-minimize')
    ) {
      return;
    }

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    const rect = this.modal.element.getBoundingClientRect();
    this.modalStartX = rect.left;
    this.modalStartY = rect.top;

    e.preventDefault();
  }

  /**
   * Handle mousemove for dragging
   * @param {MouseEvent} e - Mouse event
   */
  _onMouseMove(e) {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    const newLeft = this.modalStartX + deltaX;
    const newTop = this.modalStartY + deltaY;
    const width = this.modal.element.offsetWidth;
    const height = this.modal.element.offsetHeight;

    const clamped = this.clampPosition(newLeft, newTop, width, height);
    this.modal.element.style.left = `${clamped.left}px`;
    this.modal.element.style.top = `${clamped.top}px`;
  }

  /**
   * Handle mouseup to end dragging
   */
  _onMouseUp() {
    this.isDragging = false;
  }

  /**
   * Clamp position to keep modal within viewport
   * @param {number} left - Desired left position
   * @param {number} top - Desired top position
   * @param {number} width - Modal width
   * @param {number} height - Modal height
   * @returns {{ left: number, top: number }} Clamped position
   */
  clampPosition(left, top, width, height) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Modal must stay completely within viewport
    const clampedLeft = Math.max(0, Math.min(viewportWidth - width, left));
    const clampedTop = Math.max(0, Math.min(viewportHeight - height, top));

    return { left: clampedLeft, top: clampedTop };
  }

  /**
   * Check if currently dragging
   * @returns {boolean} True if dragging
   */
  isActive() {
    return this.isDragging;
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (this.dragHandle) {
      this.dragHandle.removeEventListener('mousedown', this._onMouseDown);
    }
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.dragHandle = null;
  }
}
