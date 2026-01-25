/**
 * Context menu handling for kanban board
 */

import { showModal } from './metadata-modal.js';

let activeMenu = null;
let targetTaskElement = null;

/**
 * Initialize context menu handlers
 */
export function initContextMenu() {
    // Prevent default context menu on entire page
    document.addEventListener('contextmenu', handleContextMenu);

    // Close menu on click outside, escape, or scroll
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideContextMenu();
    });
    document.addEventListener('scroll', hideContextMenu, true);

    // Attach menu item click handlers
    document.getElementById('task-context-menu')?.addEventListener('click', handleTaskMenuClick);
    document.getElementById('board-context-menu')?.addEventListener('click', handleBoardMenuClick);
}

function handleContextMenu(event) {
    event.preventDefault();
    hideContextMenu();

    // Check if right-clicked on a task card
    const taskElement = event.target.closest('.task');

    if (taskElement) {
        showTaskContextMenu(event, taskElement);
    } else {
        showBoardContextMenu(event);
    }
}

function showTaskContextMenu(event, taskElement) {
    targetTaskElement = taskElement;
    const menu = document.getElementById('task-context-menu');
    positionMenu(menu, event.clientX, event.clientY);
    menu.classList.remove('hidden');
    activeMenu = menu;
}

function showBoardContextMenu(event) {
    const menu = document.getElementById('board-context-menu');
    positionMenu(menu, event.clientX, event.clientY);
    menu.classList.remove('hidden');
    activeMenu = menu;
}

function positionMenu(menu, x, y) {
    // Temporarily show to get dimensions
    menu.style.visibility = 'hidden';
    menu.classList.remove('hidden');

    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust position if menu would overflow viewport
    if (x + menuRect.width > viewportWidth) {
        x = viewportWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > viewportHeight) {
        y = viewportHeight - menuRect.height - 10;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.visibility = 'visible';
    menu.classList.add('hidden'); // Will be removed by caller
}

export function hideContextMenu() {
    if (activeMenu) {
        activeMenu.classList.add('hidden');
        activeMenu = null;
    }
    targetTaskElement = null;
}

function handleTaskMenuClick(event) {
    const menuItem = event.target.closest('.context-menu-item');
    if (!menuItem) return;

    const action = menuItem.dataset.action;

    switch (action) {
        case 'show-details':
            if (targetTaskElement) {
                targetTaskElement.classList.toggle('expanded');
                targetTaskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            break;
        case 'view-metadata':
            if (targetTaskElement) {
                const taskName = targetTaskElement.querySelector('.task-name')?.textContent;
                if (taskName) showModal(taskName);
            }
            break;
    }

    hideContextMenu();
}

function handleBoardMenuClick(event) {
    const menuItem = event.target.closest('.context-menu-item');
    if (!menuItem) return;

    const action = menuItem.dataset.action;

    switch (action) {
        case 'refresh':
            // Call the global fetchAndRender
            if (window.refreshBoard) {
                window.refreshBoard();
            }
            break;
        case 'collapse-all':
            document.querySelectorAll('.task.expanded').forEach(task => {
                task.classList.remove('expanded');
            });
            break;
        case 'expand-all':
            document.querySelectorAll('.task').forEach(task => {
                task.classList.add('expanded');
            });
            break;
    }

    hideContextMenu();
}
