/**
 * Column minimize/maximize interactions
 */

import { getColumnState, saveColumnState } from './state.js';

let maximizedColumn = null;

export function getMaximizedColumn() {
  return maximizedColumn;
}

export function setMaximizedColumn(value) {
  maximizedColumn = value;
}

export function toggleMinimize(event, columnId) {
  event.stopPropagation();
  const column = document.querySelector(`[data-column="${columnId}"]`);
  if (!column) return;

  // If maximized, exit maximize mode first
  if (maximizedColumn) {
    exitMaximizeMode();
  }

  const isMinimized = column.classList.toggle('minimized');
  const state = getColumnState();

  if (isMinimized) {
    if (!state.minimized.includes(columnId)) {
      state.minimized.push(columnId);
    }
  } else {
    state.minimized = state.minimized.filter((id) => id !== columnId);
  }

  saveColumnState(state.minimized, state.maximized);
}

export function toggleMaximize(event, columnId) {
  event.stopPropagation();
  const column = document.querySelector(`[data-column="${columnId}"]`);
  if (!column) return;

  const board = document.querySelector('.board');
  const allColumns = document.querySelectorAll('.column');

  if (maximizedColumn === columnId) {
    // Exit maximize mode
    exitMaximizeMode();
  } else {
    // Enter maximize mode
    maximizedColumn = columnId;
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

    const state = getColumnState();
    state.maximized = columnId;
    saveColumnState(state.minimized, state.maximized);
  }
}

export function exitMaximizeMode() {
  const board = document.querySelector('.board');
  const allColumns = document.querySelectorAll('.column');
  const state = getColumnState();

  board.classList.remove('has-maximized');
  maximizedColumn = null;

  allColumns.forEach((col) => {
    const colId = col.dataset.column;
    col.classList.remove('maximized', 'hidden');

    // Restore minimized state if it was minimized before
    if (state.minimized.includes(colId)) {
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

  state.maximized = null;
  saveColumnState(state.minimized, state.maximized);
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
  const state = getColumnState();

  // Restore minimized columns
  state.minimized.forEach((columnId) => {
    const column = document.querySelector(`[data-column="${columnId}"]`);
    if (column) {
      column.classList.add('minimized');
    }
  });

  // Restore maximized column
  if (state.maximized) {
    const fakeEvent = {
      stopPropagation: () => {},
    };
    toggleMaximize(fakeEvent, state.maximized);
  }
}
