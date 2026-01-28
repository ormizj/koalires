/**
 * Formatting utilities - dates, times, and display formatting
 */

/**
 * Format a date to a localized string
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

/**
 * Parse markdown to HTML
 * Supports: headers, bold, italic, code, links, lists, blockquotes, horizontal rules
 * @param {string} text - Markdown text
 * @returns {string} HTML string
 */
export function parseMarkdown(text) {
  if (!text) return '';

  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (must be first to prevent inner parsing)
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    '<pre><code>$2</code></pre>'
  );

  // Split into lines for block-level processing
  const lines = html.split('\n');
  let result = [];
  let inList = false;
  let listType = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      result.push(`<h${level}>${headerMatch[2]}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      result.push('<hr>');
      continue;
    }

    // Blockquote (note: > is escaped to &gt;)
    if (line.startsWith('&gt; ')) {
      result.push(`<blockquote>${line.slice(5)}</blockquote>`);
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li>${ulMatch[1]}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${olMatch[1]}</li>`);
      continue;
    }

    // Close list if not a list item
    if (inList) {
      result.push(`</${listType}>`);
      inList = false;
      listType = null;
    }

    // Regular line
    result.push(line);
  }

  // Close any open list
  if (inList) {
    result.push(`</${listType}>`);
  }

  html = result.join('\n');

  // Inline formatting (after block processing)
  html = html
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Convert remaining single newlines to <br> (but not around block elements)
  html = html.replace(/(?<!>)\n(?!<)/g, '<br>');

  return html;
}

/**
 * Format a date string to relative time (e.g., "5 min ago")
 * @param {string} dateStr - ISO date string
 * @returns {string} Relative time string
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

/**
 * Calculate duration between two dates
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @returns {string|null} Duration string or null
 */
export function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;

  if (diffMs < 0) return null;

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;

  if (diffHour > 0) {
    return `${diffHour}h ${remainMin}m`;
  }
  return `${diffMin}m`;
}

/**
 * Format token count with K/M suffix
 * @param {number} tokens - Token count
 * @returns {string} Formatted token string
 */
export function formatTokens(tokens) {
  if (!tokens || tokens === 0) return '0';
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}
