/**
 * DOM utility functions
 */

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create an element with optional attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes to set
 * @param {Array} children - Child elements or text
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Query selector shorthand
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query selector all shorthand
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {NodeList}
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}
