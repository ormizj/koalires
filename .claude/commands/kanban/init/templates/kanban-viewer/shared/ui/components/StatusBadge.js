/**
 * Status Badge Component
 * Renders a status indicator badge
 */

import { getStatusLabel, getStatusClass } from '../../tasks.js';

/**
 * Create a status badge HTML string
 * @param {string} status - Status code
 * @param {Object} options - Options { className, size }
 * @returns {string} HTML string
 */
export function createStatusBadge(status, options = {}) {
  const { className = '', size = 'default' } = options;
  const statusClass = getStatusClass(status);
  const label = getStatusLabel(status);

  const sizeClass = size === 'small' ? 'status-badge-sm' : '';

  return `<span class="status-badge ${statusClass} ${sizeClass} ${className}">${label}</span>`;
}

/**
 * Create a status dot HTML string
 * @param {string} status - Status code
 * @param {Object} options - Options { className }
 * @returns {string} HTML string
 */
export function createStatusDot(status, options = {}) {
  const { className = '' } = options;
  const statusClass = getStatusClass(status);

  return `<span class="status-dot ${statusClass} ${className}"></span>`;
}
