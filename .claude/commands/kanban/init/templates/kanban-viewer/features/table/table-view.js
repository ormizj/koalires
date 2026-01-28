/**
 * Table View Controller - manages table view rendering and sorting
 */

import {
  formatRelativeTime,
  calculateDuration,
  formatTokens,
} from '../../shared/utils/format.js';
import { getTaskStatus } from '../../shared/tasks.js';
import { showTaskModal } from '../task-modal/index.js';

export const tableView = {
  // Internal state
  _currentTasks: [],
  _originalOrder: [],
  _currentSort: { column: null, direction: null },

  /**
   * Render the table view with tasks
   * @param {Object} boardData - Board data
   * @param {Object} progressData - Progress data
   */
  render(boardData, progressData) {
    if (!boardData?.tasks) return;

    this._originalOrder = boardData.tasks.map((task) => {
      const progress = progressData?.[task.name] || {};
      const status = getTaskStatus(task, progressData || {});
      const tokensUsed = progress.tokensUsed || [];
      const finalTokens =
        tokensUsed.length > 0 ? tokensUsed[tokensUsed.length - 1] : 0;

      return {
        name: task.name,
        category: task.category || '',
        status: status,
        startedAt: progress.startedAt || null,
        completedAt: progress.completedAt || null,
        tokens: finalTokens,
        raw: task,
      };
    });

    this._currentTasks = [...this._originalOrder];
    this._sortTasks();
    this._renderRows();
  },

  /**
   * Initialize table sort handlers
   */
  initSort() {
    const headers = document.querySelectorAll('.task-table th[data-sort]');
    headers.forEach((header) => {
      header.addEventListener('click', () => {
        this._handleSortClick(header.dataset.sort);
      });
    });
  },

  _handleSortClick(column) {
    if (this._currentSort.column === column) {
      // Same column: cycle asc -> desc -> none
      if (this._currentSort.direction === 'asc') {
        this._currentSort.direction = 'desc';
      } else if (this._currentSort.direction === 'desc') {
        this._currentSort.column = null;
        this._currentSort.direction = null;
      }
    } else {
      // Different column: start with asc
      this._currentSort.column = column;
      this._currentSort.direction = 'asc';
    }

    this._updateSortIndicators();
    this._sortTasks();
    this._renderRows();
  },

  _sortTasks() {
    // No sort active - restore original order
    if (!this._currentSort.column || !this._currentSort.direction) {
      this._currentTasks = [...this._originalOrder];
      return;
    }

    this._currentTasks.sort((a, b) => {
      const valueA = this._getSortValue(a, this._currentSort.column);
      const valueB = this._getSortValue(b, this._currentSort.column);

      let comparison = 0;

      if (valueA === null && valueB === null) {
        comparison = 0;
      } else if (valueA === null) {
        comparison = 1;
      } else if (valueB === null) {
        comparison = -1;
      } else if (typeof valueA === 'string') {
        comparison = valueA.localeCompare(valueB);
      } else {
        comparison = valueA - valueB;
      }

      return this._currentSort.direction === 'asc' ? comparison : -comparison;
    });
  },

  _getSortValue(task, column) {
    switch (column) {
      case 'name':
        return task.name.toLowerCase();
      case 'category':
        return task.category.toLowerCase();
      case 'status':
        return this._getStatusOrder(task.status);
      case 'started':
        return task.startedAt ? new Date(task.startedAt).getTime() : null;
      case 'ended':
        return task.completedAt ? new Date(task.completedAt).getTime() : null;
      case 'duration':
        return this._getDurationMs(task.startedAt, task.completedAt);
      case 'tokens':
        return task.tokens || 0;
      default:
        return null;
    }
  },

  _getStatusOrder(status) {
    const order = {
      'in-progress': 0,
      'code-review': 1,
      blocked: 2,
      pending: 3,
      completed: 4,
    };
    return order[status] ?? 5;
  },

  _getDurationMs(startedAt, completedAt) {
    if (!startedAt || !completedAt) return null;
    return new Date(completedAt).getTime() - new Date(startedAt).getTime();
  },

  _updateSortIndicators() {
    const headers = document.querySelectorAll('.task-table th[data-sort]');
    headers.forEach((header) => {
      header.classList.remove('sort-asc', 'sort-desc');
      if (header.dataset.sort === this._currentSort.column) {
        header.classList.add(
          this._currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc'
        );
      }
    });
  },

  _renderRows() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    tbody.innerHTML = this._currentTasks
      .map((task) => this._createTableRow(task))
      .join('');

    // Add click handlers for row selection
    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.table-action-btn')) return;
        const taskName = row.dataset.taskName;
        if (taskName) {
          showTaskModal(taskName);
        }
      });
    });
  },

  _createTableRow(task) {
    const statusClass = this._getStatusClass(task.status);
    const statusLabel = this._getStatusLabel(task.status);
    const categoryClass = `category-${task.category}`;
    const duration = calculateDuration(task.startedAt, task.completedAt);

    return `
      <tr data-task-name="${this._escapeHtml(task.name)}">
        <td>
          <span class="table-task-name">${this._escapeHtml(task.name)}</span>
        </td>
        <td>
          <span class="table-category-badge ${categoryClass}">${this._escapeHtml(task.category)}</span>
        </td>
        <td>
          <span class="table-status-badge ${statusClass}">${statusLabel}</span>
        </td>
        <td>${task.startedAt ? formatRelativeTime(task.startedAt) : '-'}</td>
        <td>${task.completedAt ? formatRelativeTime(task.completedAt) : '-'}</td>
        <td>${duration || '-'}</td>
        <td>${task.tokens > 0 ? formatTokens(task.tokens) : '-'}</td>
      </tr>
    `;
  },

  _getStatusClass(status) {
    const classMap = {
      pending: 'pending',
      'in-progress': 'in-progress',
      'code-review': 'code-review',
      completed: 'completed',
      blocked: 'blocked',
    };
    return classMap[status] || 'pending';
  },

  _getStatusLabel(status) {
    const labelMap = {
      pending: 'Pending',
      'in-progress': 'In Progress',
      'code-review': 'Code Review',
      completed: 'Completed',
      blocked: 'Hold',
    };
    return labelMap[status] || status;
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};
