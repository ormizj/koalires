/**
 * SidebarTaskList - Shared component for rendering task lists in modal sidebars
 * Used by both metadata-modal and task-modal
 */

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get CSS class for status
 */
function getStatusClass(status) {
  const statusMap = {
    pending: 'pending',
    'in-progress': 'in-progress',
    'code-review': 'review',
    completed: 'completed',
    blocked: 'blocked',
  };
  return statusMap[status] || 'pending';
}

/**
 * SidebarTaskList class for rendering and managing task lists in sidebars
 */
export class SidebarTaskList {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.containerId - DOM ID of the list container
   * @param {Function} config.getStatusFn - (taskName, progressData) => status
   * @param {Function} config.onSelectFn - (taskName, index) => void
   * @param {Object} config.features - Feature flags
   * @param {boolean} config.features.searchIcon - Show search icon on hover
   * @param {Function} config.features.onSearchClick - (taskName) => void
   * @param {boolean} config.features.loadingState - Support loading state
   * @param {boolean} config.features.extendedIcon - Use file icon with lines
   */
  constructor(config) {
    this.containerId = config.containerId;
    this.getStatusFn = config.getStatusFn;
    this.onSelectFn = config.onSelectFn;
    this.features = config.features || {};
    this.taskNames = [];
    this.activeIndex = 0;
  }

  /**
   * Get the container element
   */
  getContainer() {
    return document.getElementById(this.containerId);
  }

  /**
   * Render the task list
   * @param {string[]} taskNames - Array of task names
   * @param {Object} progressData - Progress data (optional)
   * @param {boolean} isLoading - Whether to show loading state (optional)
   */
  render(taskNames, progressData = null, isLoading = false) {
    const container = this.getContainer();
    if (!container) return;

    this.taskNames = taskNames;

    container.innerHTML = taskNames
      .map((taskName, index) => {
        const status =
          isLoading && this.features.loadingState
            ? 'loading'
            : this.getStatusFn(taskName, progressData);
        const statusClass =
          isLoading && this.features.loadingState
            ? 'loading'
            : getStatusClass(status);
        const isActive = index === this.activeIndex;

        return this._renderTaskItem(taskName, index, statusClass, isActive);
      })
      .join('');

    this._attachEventListeners(container);
  }

  /**
   * Render a single task item
   */
  _renderTaskItem(taskName, index, statusClass, isActive) {
    const iconSvg = this.features.extendedIcon
      ? `<svg class="sidebar-task-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
           <polyline points="14 2 14 8 20 8"/>
           <line x1="16" y1="13" x2="8" y2="13"/>
           <line x1="16" y1="17" x2="8" y2="17"/>
           <polyline points="10 9 9 9 8 9"/>
         </svg>`
      : `<svg class="sidebar-task-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
           <polyline points="14 2 14 8 20 8"/>
         </svg>`;

    const searchIconHtml = this.features.searchIcon
      ? `<svg class="sidebar-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <circle cx="7" cy="7" r="4.5"/>
           <path d="M10.5 10.5L14 14"/>
         </svg>`
      : '';

    const statusContainer = this.features.searchIcon
      ? `<div class="sidebar-task-status-container">
           <span class="sidebar-task-status ${statusClass}"></span>
           ${searchIconHtml}
         </div>`
      : `<span class="sidebar-task-status ${statusClass}"></span>`;

    return `
      <div class="sidebar-task-item ${isActive ? 'active' : ''}"
           data-task-index="${index}"
           data-task-name="${taskName}"
           title="${taskName}">
        ${iconSvg}
        <span class="sidebar-task-name">${escapeHtml(taskName)}</span>
        ${statusContainer}
      </div>
    `;
  }

  /**
   * Attach event listeners to task items
   */
  _attachEventListeners(container) {
    container.querySelectorAll('.sidebar-task-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (
          this.features.searchIcon &&
          e.target.closest('.sidebar-search-icon')
        )
          return;

        const index = parseInt(item.dataset.taskIndex, 10);
        const name = item.dataset.taskName;
        this.onSelectFn(name, index);
      });

      if (this.features.searchIcon && this.features.onSearchClick) {
        const searchIcon = item.querySelector('.sidebar-search-icon');
        if (searchIcon) {
          searchIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskName = item.dataset.taskName;
            this.features.onSearchClick(taskName);
          });
        }
      }
    });
  }

  /**
   * Update task status dots based on progress data
   * @param {Object} progressData - Progress data
   */
  updateStatus(progressData) {
    const container = this.getContainer();
    if (!container) return;

    container.querySelectorAll('.sidebar-task-item').forEach((item) => {
      const taskName = item.dataset.taskName;
      const status = this.getStatusFn(taskName, progressData);
      const statusClass = getStatusClass(status);

      const statusDot = this.features.searchIcon
        ? item.querySelector(
            '.sidebar-task-status-container .sidebar-task-status'
          )
        : item.querySelector('.sidebar-task-status');

      if (statusDot) {
        statusDot.className = `sidebar-task-status ${statusClass}`;
      }
    });
  }

  /**
   * Set the active task by index
   * @param {number} index - Index of task to make active
   */
  setActiveIndex(index) {
    this.activeIndex = index;
    const container = this.getContainer();
    if (!container) return;

    container.querySelectorAll('.sidebar-task-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  /**
   * Clear the task list
   */
  clear() {
    const container = this.getContainer();
    if (container) {
      container.innerHTML = '';
    }
    this.taskNames = [];
    this.activeIndex = 0;
  }

  /**
   * Destroy the instance and clean up
   */
  destroy() {
    this.clear();
  }
}
