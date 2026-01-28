/**
 * Column minimize/maximize interactions
 */

import { boardStore } from '../../shared/store/index.js';

export function getMaximizedColumn() {
  return boardStore.getMaximizedColumn();
}

export function setMaximizedColumn(value) {
  boardStore.setColumnMaximized(value);
}

export function toggleMinimize(event, columnId) {
  event.stopPropagation();
  const column = document.querySelector(`[data-column="${columnId}"]`);
  if (!column) return;

  // Disable auto-collapse when manually minimizing
  if (boardStore.isAutoCollapseEnabled(columnId)) {
    boardStore.disableAutoCollapse(columnId);
    const autoBtn = column.querySelector('.auto-btn');
    if (autoBtn) {
      autoBtn.classList.remove('active');
      autoBtn.title = 'Auto mode OFF';
    }
    column.classList.remove('auto-active');
  }

  // If maximized, exit maximize mode first
  if (boardStore.hasMaximizedColumn()) {
    exitMaximizeMode();
  }

  const isCurrentlyMinimized = boardStore.isColumnMinimized(columnId);

  if (isCurrentlyMinimized) {
    boardStore.minimizedColumns.delete(columnId);
    column.classList.remove('minimized');
  } else {
    boardStore.minimizedColumns.add(columnId);
    column.classList.add('minimized');
  }

  boardStore.saveColumnState();
}

export function toggleMaximize(event, columnId) {
  event.stopPropagation();
  const column = document.querySelector(`[data-column="${columnId}"]`);
  if (!column) return;

  const board = document.querySelector('.board');
  const allColumns = document.querySelectorAll('.column');

  if (boardStore.getMaximizedColumn() === columnId) {
    // Exit maximize mode
    exitMaximizeMode();
  } else {
    // Enter maximize mode
    boardStore.setColumnMaximized(columnId);
    board.classList.add('has-maximized');

    allColumns.forEach((col) => {
      const colId = col.dataset.column;
      if (colId === columnId) {
        col.classList.remove('minimized', 'hidden');
        col.classList.add('maximized');
        // Update button to show close icon
        const maxBtn = col.querySelector('.maximize-btn');
        if (maxBtn) {
          maxBtn.innerHTML =
            '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          maxBtn.title = 'Restore';
          maxBtn.classList.add('active');
        }
      } else {
        col.classList.add('hidden');
      }
    });
  }
}

export function exitMaximizeMode() {
  const board = document.querySelector('.board');
  const allColumns = document.querySelectorAll('.column');

  board.classList.remove('has-maximized');
  boardStore.clearMaximized();

  allColumns.forEach((col) => {
    const colId = col.dataset.column;
    col.classList.remove('maximized', 'hidden');

    // Restore minimized state if it was minimized before
    if (boardStore.isColumnMinimized(colId)) {
      col.classList.add('minimized');
    }

    // Reset maximize button
    const maxBtn = col.querySelector('.maximize-btn');
    if (maxBtn) {
      maxBtn.innerHTML =
        '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
      maxBtn.title = 'Maximize';
      maxBtn.classList.remove('active');
    }
  });
}

export function handleColumnClick(event, column) {
  // Only restore if column is minimized and click is not on a button or task
  if (column.classList.contains('minimized')) {
    const isButton = event.target.closest('.control-btn');
    const isTask = event.target.closest('.task');
    if (!isButton && !isTask) {
      const columnId = column.dataset.column;
      toggleMinimize(event, columnId);
    }
  }
}

export function restoreColumnState() {
  // Restore minimized columns
  boardStore.minimizedColumns.forEach((columnId) => {
    const column = document.querySelector(`[data-column="${columnId}"]`);
    if (column) {
      column.classList.add('minimized');
    }
  });

  // Restore auto-collapse button states
  boardStore.autoCollapseColumns.forEach((columnId) => {
    const column = document.querySelector(`[data-column="${columnId}"]`);
    if (column) {
      const autoBtn = column.querySelector('.auto-btn');
      if (autoBtn) {
        autoBtn.classList.add('active');
        autoBtn.title = 'Auto mode ON';
      }
      column.classList.add('auto-active');
    }
  });

  // Restore maximized column
  const maximizedColumn = boardStore.getMaximizedColumn();
  if (maximizedColumn) {
    const fakeEvent = {
      stopPropagation: () => {},
    };
    toggleMaximize(fakeEvent, maximizedColumn);
  }
}

export function toggleAutoCollapse(event, columnId) {
  event.stopPropagation();
  const column = document.querySelector(`[data-column="${columnId}"]`);
  if (!column) return;

  const isNowEnabled = boardStore.toggleAutoCollapse(columnId);
  const autoBtn = column.querySelector('.auto-btn');

  if (autoBtn) {
    autoBtn.classList.toggle('active', isNowEnabled);
    autoBtn.title = isNowEnabled ? 'Auto mode ON' : 'Auto mode OFF';
  }

  column.classList.toggle('auto-active', isNowEnabled);

  if (isNowEnabled) {
    applyAutoCollapseForColumn(columnId);
  }
}

function applyAutoCollapseForColumn(columnId) {
  const column = document.querySelector(`[data-column="${columnId}"]`);
  if (!column) return;

  const tasksContainer = column.querySelector('.tasks');
  const taskCount = tasksContainer
    ? tasksContainer.querySelectorAll('.task').length
    : 0;
  const shouldMinimize = taskCount === 0;
  const isMinimized = boardStore.isColumnMinimized(columnId);

  if (shouldMinimize && !isMinimized) {
    boardStore.minimizedColumns.add(columnId);
    column.classList.add('minimized');
    boardStore.saveColumnState();
  } else if (!shouldMinimize && isMinimized) {
    boardStore.minimizedColumns.delete(columnId);
    column.classList.remove('minimized');
    boardStore.saveColumnState();
  }
}

export function applyAutoCollapseAll() {
  ['pending', 'blocked', 'progress', 'review', 'completed'].forEach(
    (columnId) => {
      if (boardStore.isAutoCollapseEnabled(columnId)) {
        applyAutoCollapseForColumn(columnId);
      }
    }
  );
}
