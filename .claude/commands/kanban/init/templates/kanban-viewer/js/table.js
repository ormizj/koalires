/**
 * Table view for kanban board - displays tasks in a sortable table format
 */

import {
  formatRelativeTime,
  calculateDuration,
  formatTokens,
} from './formatters.js';
import { getTaskStatus } from './tasks.js';
import { showModal } from './metadata-modal.js';

let currentTasks = [];
let originalOrder = [];
let currentSort = { column: null, direction: null };

/**
 * Render the table view with board and progress data
 */
export function renderTable(boardData, progressData) {
  if (!boardData?.tasks) return;

  originalOrder = boardData.tasks.map((task) => {
    const progress = progressData[task.name] || {};
    const status = getTaskStatus(task, progressData);
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

  currentTasks = [...originalOrder];
  sortTasks();
  renderTableRows();
}

/**
 * Initialize table sort handlers
 */
export function initTableSort() {
  const headers = document.querySelectorAll('.task-table th[data-sort]');
  headers.forEach((header) => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;
      handleSortClick(column);
    });
  });
}

/**
 * Handle sort header click - cycles through: none -> asc -> desc -> none
 */
function handleSortClick(column) {
  if (currentSort.column === column) {
    // Same column: cycle asc -> desc -> none
    if (currentSort.direction === 'asc') {
      currentSort.direction = 'desc';
    } else if (currentSort.direction === 'desc') {
      currentSort.column = null;
      currentSort.direction = null;
    }
  } else {
    // Different column: start with asc
    currentSort.column = column;
    currentSort.direction = 'asc';
  }

  updateSortIndicators();
  sortTasks();
  renderTableRows();
}

/**
 * Update sort indicators on table headers
 */
function updateSortIndicators() {
  const headers = document.querySelectorAll('.task-table th[data-sort]');
  headers.forEach((header) => {
    header.classList.remove('sort-asc', 'sort-desc');
    if (header.dataset.sort === currentSort.column) {
      header.classList.add(
        currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc'
      );
    }
  });
}

/**
 * Sort tasks based on current sort settings
 */
function sortTasks() {
  // No sort active - restore original order
  if (!currentSort.column || !currentSort.direction) {
    currentTasks = [...originalOrder];
    return;
  }

  currentTasks.sort((a, b) => {
    const valueA = getSortValue(a, currentSort.column);
    const valueB = getSortValue(b, currentSort.column);

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

    return currentSort.direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Get sortable value for a task column
 */
function getSortValue(task, column) {
  switch (column) {
    case 'name':
      return task.name.toLowerCase();
    case 'category':
      return task.category.toLowerCase();
    case 'status':
      return getStatusOrder(task.status);
    case 'started':
      return task.startedAt ? new Date(task.startedAt).getTime() : null;
    case 'ended':
      return task.completedAt ? new Date(task.completedAt).getTime() : null;
    case 'duration':
      return getDurationMs(task.startedAt, task.completedAt);
    case 'tokens':
      return task.tokens || 0;
    default:
      return null;
  }
}

/**
 * Get status order for sorting
 */
function getStatusOrder(status) {
  const order = {
    'in-progress': 0,
    'code-review': 1,
    blocked: 2,
    pending: 3,
    completed: 4,
  };
  return order[status] ?? 5;
}

/**
 * Calculate duration in milliseconds for sorting
 */
function getDurationMs(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  return new Date(completedAt).getTime() - new Date(startedAt).getTime();
}

/**
 * Render table rows
 */
function renderTableRows() {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  tbody.innerHTML = currentTasks.map((task) => createTableRow(task)).join('');

  tbody.querySelectorAll('tr').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.table-action-btn')) return;
      const taskName = row.dataset.taskName;
      if (taskName) {
        showModal(taskName);
      }
    });
  });
}

/**
 * Create HTML for a single table row
 */
function createTableRow(task) {
  const statusClass = getStatusClass(task.status);
  const statusLabel = getStatusLabel(task.status);
  const categoryClass = `category-${task.category}`;
  const duration = calculateDuration(task.startedAt, task.completedAt);

  return `
    <tr data-task-name="${escapeHtml(task.name)}">
      <td>
        <span class="table-task-name">${escapeHtml(task.name)}</span>
      </td>
      <td>
        <span class="table-category-badge ${categoryClass}">${escapeHtml(task.category)}</span>
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
}

/**
 * Get CSS class for status badge
 */
function getStatusClass(status) {
  const classMap = {
    pending: 'pending',
    'in-progress': 'in-progress',
    'code-review': 'code-review',
    completed: 'completed',
    blocked: 'blocked',
  };
  return classMap[status] || 'pending';
}

/**
 * Get display label for status
 */
function getStatusLabel(status) {
  const labelMap = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    'code-review': 'Code Review',
    completed: 'Completed',
    blocked: 'Hold',
  };
  return labelMap[status] || status;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
