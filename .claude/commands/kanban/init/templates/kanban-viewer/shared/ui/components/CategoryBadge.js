/**
 * Category Badge Component
 * Renders a category indicator badge
 */

import { escapeHtml } from '../../utils/dom.js';

/**
 * Get category CSS class
 * @param {string} category - Category name
 * @returns {string} CSS class name
 */
export function getCategoryClass(category) {
  if (!category) return 'category-default';

  const lowerCategory = category.toLowerCase();
  const classes = {
    data: 'category-data',
    api: 'category-api',
    ui: 'category-ui',
    integration: 'category-integration',
    config: 'category-config',
    testing: 'category-testing',
  };

  return classes[lowerCategory] || 'category-default';
}

/**
 * Create a category badge HTML string
 * @param {string} category - Category name
 * @param {Object} options - Options { className }
 * @returns {string} HTML string
 */
export function createCategoryBadge(category, options = {}) {
  const { className = '' } = options;

  if (!category) return '';

  const categoryClass = getCategoryClass(category);
  const label = escapeHtml(category);

  return `<span class="category-badge ${categoryClass} ${className}">${label}</span>`;
}
