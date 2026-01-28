/**
 * Context menu handling for kanban board
 */

import { showModal, showColumnModal } from '../metadata-modal/index.js';
import { showTaskModal, showColumnTaskModal } from '../task-modal/index.js';
import { getBoardData, getProgressData } from '../../core/data.js';
import { getTaskStatus } from '../../shared/tasks.js';
import { tableView } from '../table/table-view.js';
import { boardStore } from '../../shared/store/index.js';

let activeMenu = null;
let targetTaskElement = null;
let targetColumnElement = null;
let targetColumnId = null;

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
  document
    .getElementById('task-context-menu')
    ?.addEventListener('click', handleTaskMenuClick);
  document
    .getElementById('app-context-menu')
    ?.addEventListener('click', handleAppMenuClick);
  document
    .getElementById('column-context-menu')
    ?.addEventListener('click', handleColumnMenuClick);
}

function handleContextMenu(event) {
  event.preventDefault();
  hideContextMenu();

  // Check if right-clicked on a task card
  const taskElement = event.target.closest('.task');
  if (taskElement) {
    showTaskContextMenu(event, taskElement);
    return;
  }

  // Check if right-clicked on a status badge in the table
  const statusBadge = event.target.closest('.table-status-badge');
  if (statusBadge) {
    const statusToColumnMap = {
      pending: 'pending',
      'in-progress': 'progress',
      'code-review': 'review',
      completed: 'completed',
      blocked: 'blocked',
    };
    // Find which status class the badge has
    const statusClass = Object.keys(statusToColumnMap).find((status) =>
      statusBadge.classList.contains(status)
    );
    if (statusClass) {
      const columnId = statusToColumnMap[statusClass];
      const columnElement = document.querySelector(
        `.column[data-column="${columnId}"]`
      );
      showColumnContextMenu(event, columnId, columnElement);
      return;
    }
  }

  // Check if right-clicked on a table row
  const tableRow = event.target.closest('.task-table tbody tr.table-row-main');
  if (tableRow) {
    showTableRowContextMenu(event, tableRow);
    return;
  }

  // Check if right-clicked on a detail row (worker/qa) - find associated main row
  const detailRow = event.target.closest('.task-table tbody tr.table-row-detail');
  if (detailRow) {
    // Find the associated main row (previous sibling with table-row-main class)
    let mainRow = detailRow.previousElementSibling;
    while (mainRow && !mainRow.classList.contains('table-row-main')) {
      mainRow = mainRow.previousElementSibling;
    }
    if (mainRow) {
      showTableRowContextMenu(event, mainRow);
    }
    return;
  }

  // Check if right-clicked on a column
  const columnElement = event.target.closest('.column');
  if (columnElement) {
    showColumnContextMenu(event, columnElement.dataset.column, columnElement);
    return;
  }

  // Default: show app context menu
  showAppContextMenu(event);
}

function showTaskContextMenu(event, taskElement) {
  targetTaskElement = taskElement;
  const menu = document.getElementById('task-context-menu');

  // Update header with task name
  const taskName =
    taskElement.querySelector('.task-name')?.textContent || 'Task';
  const titleEl = document.getElementById('task-menu-title');
  if (titleEl) titleEl.textContent = taskName;

  // Show/hide expand/collapse based on current state
  const isExpanded = taskElement.classList.contains('expanded');
  const expandItem = menu.querySelector('[data-action="expand-task"]');
  const collapseItem = menu.querySelector('[data-action="collapse-task"]');

  if (expandItem) expandItem.classList.toggle('hidden', isExpanded);
  if (collapseItem) collapseItem.classList.toggle('hidden', !isExpanded);

  positionMenu(menu, event.clientX, event.clientY);
  menu.classList.remove('hidden');
  activeMenu = menu;
}

function showTableRowContextMenu(event, tableRow) {
  const taskName = tableRow.dataset.taskName || 'Task';

  // Store actual table row element with marker
  targetTaskElement = tableRow;
  targetTaskElement._isTableRow = true;
  targetTaskElement._taskName = taskName;

  const menu = document.getElementById('task-context-menu');

  // Update header with task name
  const titleEl = document.getElementById('task-menu-title');
  if (titleEl) titleEl.textContent = taskName;

  // Show expand/collapse based on row expansion state
  const isExpanded = tableRow.classList.contains('expanded');
  const expandItem = menu.querySelector('[data-action="expand-task"]');
  const collapseItem = menu.querySelector('[data-action="collapse-task"]');

  if (expandItem) expandItem.classList.toggle('hidden', isExpanded);
  if (collapseItem) collapseItem.classList.toggle('hidden', !isExpanded);

  positionMenu(menu, event.clientX, event.clientY);
  menu.classList.remove('hidden');
  activeMenu = menu;
}

function showAppContextMenu(event) {
  const menu = document.getElementById('app-context-menu');

  // Update task count in menu
  const boardData = getBoardData();
  const taskCount = boardData?.tasks?.length || 0;
  const countSpan = document.getElementById('board-task-count');
  const countViewSpan = document.getElementById('board-task-count-view');
  if (countSpan) countSpan.textContent = taskCount;
  if (countViewSpan) countViewSpan.textContent = taskCount;

  positionMenu(menu, event.clientX, event.clientY);
  menu.classList.remove('hidden');
  activeMenu = menu;
}

function showColumnContextMenu(event, columnId, columnElement) {
  targetColumnElement = columnElement;
  targetColumnId = columnId;

  const menu = document.getElementById('column-context-menu');

  // Update header with column name
  const columnNames = {
    pending: 'Pending',
    blocked: 'Hold',
    progress: 'In Progress',
    review: 'Code Review',
    completed: 'Completed',
  };
  const titleEl = document.getElementById('column-menu-title');
  if (titleEl) titleEl.textContent = columnNames[columnId] || columnId;

  // Update task count in menu
  const taskCount = getTasksInColumn(columnId).length;
  const countSpan = document.getElementById('column-task-count');
  const countViewSpan = document.getElementById('column-task-count-view');
  if (countSpan) countSpan.textContent = taskCount;
  if (countViewSpan) countViewSpan.textContent = taskCount;

  // Disable task view and metadata if no tasks
  const taskViewItem = menu.querySelector('[data-action="column-task-view"]');
  const metadataItem = menu.querySelector('[data-action="column-metadata"]');
  if (taskViewItem) {
    taskViewItem.classList.toggle('disabled', taskCount === 0);
  }
  if (metadataItem) {
    metadataItem.classList.toggle('disabled', taskCount === 0);
  }

  positionMenu(menu, event.clientX, event.clientY);
  menu.classList.remove('hidden');
  activeMenu = menu;
}

/**
 * Get task names in a specific column based on their status
 */
export function getTasksInColumn(columnId) {
  const boardData = getBoardData();
  const progressData = getProgressData();
  if (!boardData?.tasks) return [];

  // Map column IDs to status values
  const statusMap = {
    pending: 'pending',
    blocked: 'blocked',
    progress: 'in-progress',
    review: 'code-review',
    completed: 'completed',
  };

  const targetStatus = statusMap[columnId] || columnId;

  return boardData.tasks
    .filter((task) => {
      // Use the same getTaskStatus function as board.js
      const status = getTaskStatus(task, progressData);
      return status === targetStatus;
    })
    .map((t) => t.name);
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
  targetColumnElement = null;
  targetColumnId = null;
}

function handleTaskMenuClick(event) {
  const menuItem = event.target.closest('.context-menu-item');
  if (!menuItem) return;

  const action = menuItem.dataset.action;

  switch (action) {
    case 'view-task':
      if (targetTaskElement?._isTableRow) {
        showTaskModal(targetTaskElement._taskName);
      } else if (targetTaskElement) {
        const taskName =
          targetTaskElement.querySelector('.task-name')?.textContent;
        if (taskName) showTaskModal(taskName);
      }
      break;
    case 'expand-task':
      if (targetTaskElement?._isTableRow) {
        // Handle table row expansion
        tableView._toggleRowExpansion(targetTaskElement._taskName);
      } else if (targetTaskElement && targetTaskElement.classList) {
        // Handle board card expansion - use boardStore for persistence
        const taskName = targetTaskElement.dataset?.taskName ||
          targetTaskElement.querySelector('.task-name')?.textContent;
        if (taskName) {
          boardStore.setTaskExpanded(taskName, true);
          targetTaskElement.classList.add('expanded');
        }
      } else if (targetTaskElement) {
        const taskName = targetTaskElement.querySelector?.('.task-name')?.textContent;
        if (taskName) {
          boardStore.setTaskExpanded(taskName, true);
          const taskCard = document.querySelector(`.task[data-task-name="${taskName}"]`);
          taskCard?.classList.add('expanded');
        }
      }
      break;
    case 'collapse-task':
      if (targetTaskElement?._isTableRow) {
        // Handle table row collapse
        tableView._toggleRowExpansion(targetTaskElement._taskName);
      } else if (targetTaskElement && targetTaskElement.classList) {
        // Handle board card collapse - use boardStore for persistence
        const taskName = targetTaskElement.dataset?.taskName ||
          targetTaskElement.querySelector('.task-name')?.textContent;
        if (taskName) {
          boardStore.setTaskExpanded(taskName, false);
          targetTaskElement.classList.remove('expanded');
        }
      } else if (targetTaskElement) {
        const taskName = targetTaskElement.querySelector?.('.task-name')?.textContent;
        if (taskName) {
          boardStore.setTaskExpanded(taskName, false);
          const taskCard = document.querySelector(`.task[data-task-name="${taskName}"]`);
          taskCard?.classList.remove('expanded');
        }
      }
      break;
    case 'view-metadata':
      if (targetTaskElement?._isTableRow) {
        showModal(targetTaskElement._taskName);
      } else if (targetTaskElement) {
        const taskName =
          targetTaskElement.querySelector('.task-name')?.textContent;
        if (taskName) showModal(taskName);
      }
      break;
  }

  hideContextMenu();
}

function handleAppMenuClick(event) {
  const menuItem = event.target.closest('.context-menu-item');
  if (!menuItem) return;

  const action = menuItem.dataset.action;

  switch (action) {
    case 'board-task-view': {
      // Get all task names and show task modal with all tasks
      const boardDataTaskView = getBoardData();
      if (boardDataTaskView?.tasks?.length > 0) {
        const allTaskNamesTaskView = boardDataTaskView.tasks.map((t) => t.name);
        showColumnTaskModal('all', allTaskNamesTaskView);
      }
      break;
    }
    case 'board-metadata': {
      // Get all task names and show metadata column modal with all tasks
      const boardData = getBoardData();
      if (boardData?.tasks?.length > 0) {
        const allTaskNames = boardData.tasks.map((t) => t.name);
        showColumnModal('all', allTaskNames);
      }
      break;
    }
    case 'collapse-all':
      boardStore.collapseAllTasks();
      document.querySelectorAll('.task.expanded').forEach((task) => {
        task.classList.remove('expanded');
      });
      break;
    case 'expand-all':
      boardStore.expandAllTasks();
      document.querySelectorAll('.task').forEach((task) => {
        task.classList.add('expanded');
      });
      break;
  }

  hideContextMenu();
}

function handleColumnMenuClick(event) {
  const menuItem = event.target.closest('.context-menu-item');
  if (!menuItem || menuItem.classList.contains('disabled')) return;

  const action = menuItem.dataset.action;

  switch (action) {
    case 'column-task-view': {
      const taskNamesTaskView = getTasksInColumn(targetColumnId);
      if (taskNamesTaskView.length > 0) {
        showColumnTaskModal(targetColumnId, taskNamesTaskView);
      }
      break;
    }
    case 'column-metadata': {
      const taskNames = getTasksInColumn(targetColumnId);
      if (taskNames.length > 0) {
        showColumnModal(targetColumnId, taskNames);
      }
      break;
    }
    case 'column-collapse-all':
      if (targetColumnElement) {
        targetColumnElement.querySelectorAll('.task.expanded').forEach((task) => {
          const taskName = task.dataset.taskName;
          if (taskName) boardStore.setTaskExpanded(taskName, false);
          task.classList.remove('expanded');
        });
      }
      break;
    case 'column-expand-all':
      if (targetColumnElement) {
        targetColumnElement.querySelectorAll('.task').forEach((task) => {
          const taskName = task.dataset.taskName;
          if (taskName) boardStore.setTaskExpanded(taskName, true);
          task.classList.add('expanded');
        });
      }
      break;
  }

  hideContextMenu();
}
