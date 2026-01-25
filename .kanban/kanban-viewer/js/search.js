/**
 * Task search functionality - filters tasks by name in real-time
 */

let searchInput = null;
let searchCount = null;
let searchClear = null;
let searchContainer = null;
let debounceTimeout = null;
let currentSearchTerm = '';

/**
 * Initialize search functionality
 */
export function initSearch() {
  searchInput = document.getElementById('task-search-input');
  searchCount = document.getElementById('task-search-count');
  searchClear = document.getElementById('task-search-clear');
  searchContainer = searchInput?.closest('.task-search');

  if (!searchInput || !searchCount || !searchClear || !searchContainer) {
    console.warn('Search elements not found');
    return;
  }

  // Input event with debounce
  searchInput.addEventListener('input', (e) => {
    const value = e.target.value;

    // Toggle has-value class for clear button visibility
    if (value.length > 0) {
      searchContainer.classList.add('has-value');
    } else {
      searchContainer.classList.remove('has-value');
    }

    // Debounce the actual search
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      filterTasks(value);
    }, 150);
  });

  // Clear button
  searchClear.addEventListener('click', () => {
    clearSearch();
  });

  // Keyboard shortcuts
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch();
      searchInput.blur();
    }
  });

  // Global keyboard shortcut: Ctrl/Cmd + F to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

/**
 * Clear the search input and show all tasks
 */
function clearSearch() {
  if (searchInput) {
    searchInput.value = '';
    searchContainer.classList.remove('has-value');
  }
  filterTasks('');
}

/**
 * Filter tasks by search term
 * @param {string} term - Search term (case-insensitive)
 */
function filterTasks(term) {
  currentSearchTerm = term.toLowerCase().trim();

  const allTasks = document.querySelectorAll('.task');
  let visibleCount = 0;
  const totalCount = allTasks.length;

  allTasks.forEach((task) => {
    const taskName = task.getAttribute('data-task-name') || '';
    const matches =
      currentSearchTerm === '' ||
      taskName.toLowerCase().includes(currentSearchTerm);

    if (matches) {
      task.classList.remove('search-hidden');
      visibleCount++;
    } else {
      task.classList.add('search-hidden');
    }
  });

  // Update search count indicator
  if (currentSearchTerm && searchCount) {
    searchCount.textContent = `${visibleCount}/${totalCount}`;
  } else if (searchCount) {
    searchCount.textContent = '';
  }

  // Update column counts and empty messages
  updateColumnCounts();
}

/**
 * Update column counts to show filtered/total and handle empty messages
 */
function updateColumnCounts() {
  const columns = ['pending', 'blocked', 'progress', 'review', 'completed'];

  columns.forEach((columnId) => {
    const tasksContainer = document.getElementById(`tasks-${columnId}`);
    const countElement = document.getElementById(`count-${columnId}`);

    if (!tasksContainer) return;

    const allTasksInColumn = tasksContainer.querySelectorAll('.task');
    const visibleTasksInColumn = tasksContainer.querySelectorAll(
      '.task:not(.search-hidden)'
    );

    // Remove existing empty search message
    const existingMsg = tasksContainer.querySelector('.search-empty-msg');
    if (existingMsg) {
      existingMsg.remove();
    }

    // Update count display
    if (countElement) {
      if (currentSearchTerm && allTasksInColumn.length > 0) {
        countElement.textContent = `${visibleTasksInColumn.length}/${allTasksInColumn.length}`;
      } else {
        countElement.textContent = allTasksInColumn.length;
      }
    }

    // Show empty message if all tasks are filtered out but column has tasks
    if (
      currentSearchTerm &&
      allTasksInColumn.length > 0 &&
      visibleTasksInColumn.length === 0
    ) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'search-empty-msg';
      emptyMsg.textContent = 'No matching tasks';
      tasksContainer.appendChild(emptyMsg);
    }
  });
}

/**
 * Re-apply current search filter (call after board re-renders)
 */
export function reapplySearch() {
  if (currentSearchTerm) {
    filterTasks(currentSearchTerm);
  } else {
    // Still need to update column counts even with no search term
    // to restore original counts after a render
    updateColumnCounts();
  }
}

/**
 * Get current search term (for external use)
 */
export function getCurrentSearchTerm() {
  return currentSearchTerm;
}
