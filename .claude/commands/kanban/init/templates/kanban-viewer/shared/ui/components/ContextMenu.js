/**
 * Context Menu Component
 * Reusable context menu utility
 */

/**
 * Show a context menu at the specified position
 * @param {HTMLElement} menu - Menu element
 * @param {number} x - X position
 * @param {number} y - Y position
 */
export function showContextMenu(menu, x, y) {
  // Position the menu
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  // Show the menu
  menu.classList.remove('hidden');

  // Adjust position if menu goes off screen
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (rect.right > viewportWidth) {
    menu.style.left = `${x - rect.width}px`;
  }

  if (rect.bottom > viewportHeight) {
    menu.style.top = `${y - rect.height}px`;
  }
}

/**
 * Hide a context menu
 * @param {HTMLElement} menu - Menu element
 */
export function hideContextMenu(menu) {
  menu.classList.add('hidden');
}

/**
 * Hide all context menus
 */
export function hideAllContextMenus() {
  document.querySelectorAll('.context-menu').forEach((menu) => {
    menu.classList.add('hidden');
  });
}

/**
 * Initialize context menu close on click outside
 */
export function initContextMenuCloseHandler() {
  document.addEventListener('click', () => {
    hideAllContextMenus();
  });

  document.addEventListener('contextmenu', () => {
    hideAllContextMenus();
  });
}

/**
 * Create a context menu item HTML
 * @param {Object} item - Item configuration { icon, label, action, disabled }
 * @returns {string} HTML string
 */
export function createContextMenuItem(item) {
  const { icon = '', label, action, disabled = false } = item;
  const disabledClass = disabled ? 'disabled' : '';

  return `
    <div class="context-menu-item ${disabledClass}" data-action="${action}">
      <span class="context-menu-icon">${icon}</span>
      ${label}
    </div>
  `;
}

/**
 * Create a context menu divider HTML
 * @returns {string} HTML string
 */
export function createContextMenuDivider() {
  return '<div class="context-menu-divider"></div>';
}
