/**
 * Text formatting and date utilities
 */

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function parseMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Headers (h1-h3)
  html = html.replace(
    /^### (.+)$/gm,
    '<h4 style="color:#c9d1d9;margin:8px 0 4px;font-size:0.85rem;">$1</h4>'
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h3 style="color:#c9d1d9;margin:10px 0 6px;font-size:0.9rem;">$1</h3>'
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h2 style="color:#c9d1d9;margin:12px 0 8px;font-size:1rem;">$1</h2>'
  );

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Code blocks (fenced) - MUST run before inline code to avoid partial matches
  html = html.replace(
    /```(\w*)\s*([\s\S]*?)```/g,
    '<pre style="background:#0d1117;padding:10px;border-radius:6px;overflow-x:auto;margin:8px 0;"><code>$2</code></pre>'
  );

  // Inline code (after code blocks)
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:#30363d;padding:2px 6px;border-radius:4px;font-size:0.8rem;">$1</code>'
  );

  // Unordered lists
  html = html.replace(
    /^[-*] (.+)$/gm,
    '<li style="margin-left:16px;list-style:disc;">$1</li>'
  );

  // Ordered lists (simple)
  html = html.replace(
    /^\d+\. (.+)$/gm,
    '<li style="margin-left:16px;list-style:decimal;">$1</li>'
  );

  // Wrap consecutive list items
  html = html.replace(
    /(<li[^>]*>.*<\/li>\n?)+/g,
    '<ul style="margin:4px 0;padding-left:8px;">$&</ul>'
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#58a6ff;text-decoration:none;" target="_blank">$1</a>'
  );

  // Horizontal rules
  html = html.replace(
    /^[-*_]{3,}$/gm,
    '<hr style="border:none;border-top:1px solid #30363d;margin:10px 0;">'
  );

  // Blockquotes
  html = html.replace(
    /^&gt; (.+)$/gm,
    '<blockquote style="border-left:3px solid #30363d;padding-left:12px;color:#8b949e;margin:8px 0;">$1</blockquote>'
  );

  // Paragraphs - convert double newlines to paragraph breaks, single newlines to spaces
  html = html.replace(/\n\n+/g, '</p><p style="margin:8px 0;">');
  html = html.replace(/\n/g, ' ');
  html = '<p style="margin:8px 0;">' + html + '</p>';

  return html;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function calculateDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;

  if (diffHours > 0) {
    return `${diffHours}h ${remainingMins}m`;
  }
  return `${diffMins}m`;
}

export function formatTokens(tokens) {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + 'M';
  }
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(0) + 'K';
  }
  return tokens.toString();
}
