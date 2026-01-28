/**
 * Table Row Template
 * Renders a table row for the table view
 */

import { escapeHtml } from '../../utils/dom.js';
import {
  formatRelativeTime,
  calculateDuration,
  formatTokens,
} from '../../utils/format.js';
import { getStatusLabel, getStatusClass } from '../../tasks.js';
import { getCategoryClass } from '../components/CategoryBadge.js';

/**
 * Create table row HTML
 * @param {Object} taskData - Processed task data { name, category, status, startedAt, completedAt, tokens, raw }
 * @returns {string} HTML string
 */
export function createTableRow(taskData) {
  const { name, category, status, startedAt, completedAt, tokens } = taskData;

  const statusClass = getStatusClass(status);
  const statusLabel = getStatusLabel(status);
  const categoryClass = getCategoryClass(category);
  const duration = calculateDuration(startedAt, completedAt);

  return `
    <tr data-task-name="${escapeHtml(name)}">
      <td>
        <span class="table-task-name">${escapeHtml(name)}</span>
      </td>
      <td>
        <span class="table-category-badge ${categoryClass}">${escapeHtml(category || '')}</span>
      </td>
      <td>
        <span class="table-status-badge ${statusClass}">${statusLabel}</span>
      </td>
      <td>${startedAt ? formatRelativeTime(startedAt) : '-'}</td>
      <td>${completedAt ? formatRelativeTime(completedAt) : '-'}</td>
      <td>${duration || '-'}</td>
      <td>${tokens > 0 ? formatTokens(tokens) : '-'}</td>
    </tr>
  `;
}
