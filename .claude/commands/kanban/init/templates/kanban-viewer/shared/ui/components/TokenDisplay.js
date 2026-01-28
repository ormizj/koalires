/**
 * Token Display Component
 * Renders token usage with progress bar
 */

import { formatTokens } from '../../utils/format.js';
import { getIcon } from '../../utils/icons.js';

// Default token limit for percentage calculation
const DEFAULT_TOKEN_LIMIT = 200000;

/**
 * Calculate token percentage and severity
 * @param {number} tokens - Current token count
 * @param {number} limit - Token limit
 * @returns {Object} { percentage, severity }
 */
export function calculateTokenSeverity(tokens, limit = DEFAULT_TOKEN_LIMIT) {
  const percentage = Math.min((tokens / limit) * 100, 100);
  let severity = 'normal';

  if (percentage >= 90) {
    severity = 'danger';
  } else if (percentage >= 70) {
    severity = 'warning';
  }

  return { percentage, severity };
}

/**
 * Create a token display HTML string
 * @param {number} tokens - Token count
 * @param {Object} options - Options { limit, showBar, showIcon, className }
 * @returns {string} HTML string
 */
export function createTokenDisplay(tokens, options = {}) {
  const {
    limit = DEFAULT_TOKEN_LIMIT,
    showBar = true,
    showIcon = true,
    className = '',
  } = options;

  if (!tokens || tokens === 0) return '';

  const { percentage, severity } = calculateTokenSeverity(tokens, limit);
  const formattedTokens = formatTokens(tokens);

  const iconHtml = showIcon
    ? `<span class="token-icon">${getIcon('coin', 14)}</span>`
    : '';
  const barHtml = showBar
    ? `
    <div class="token-bar">
      <div class="token-fill ${severity}" style="width: ${percentage}%"></div>
    </div>
  `
    : '';

  return `
    <div class="token-display ${severity} ${className}">
      ${iconHtml}
      <span class="token-value">${formattedTokens}</span>
      ${barHtml}
    </div>
  `;
}

/**
 * Create a compact token display (no bar)
 * @param {number} tokens - Token count
 * @param {Object} options - Options { className }
 * @returns {string} HTML string
 */
export function createTokenBadge(tokens, options = {}) {
  const { className = '' } = options;

  if (!tokens || tokens === 0) return '';

  const formattedTokens = formatTokens(tokens);

  return `<span class="token-badge ${className}">${formattedTokens}</span>`;
}
