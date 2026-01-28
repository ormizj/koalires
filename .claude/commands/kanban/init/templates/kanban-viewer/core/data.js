/**
 * Data fetching logic - provides data to views
 */

let lastBoardData = null;
let lastProgressData = null;

// Cached data for external access
let cachedBoardData = null;
let cachedProgressData = null;
let cachedTddData = null;

/**
 * Get cached board data
 */
export function getBoardData() {
  return cachedBoardData;
}

/**
 * Get cached progress data
 */
export function getProgressData() {
  return cachedProgressData;
}

/**
 * Get cached TDD/QA token data
 */
export function getTddData() {
  return cachedTddData;
}

/**
 * Fetch TDD/QA token data from worker-logs/*-test-creation-output.json files
 * @returns {Object} TDD data keyed by task name
 */
export async function fetchTddData() {
  try {
    const tddData = {};
    const boardData = getBoardData();

    if (boardData?.tasks) {
      await Promise.all(
        boardData.tasks.map(async (task) => {
          try {
            const response = await fetch(
              `../worker-logs/${task.name}-test-creation-output.json?${Date.now()}`
            );
            if (response.ok) {
              const data = await response.json();
              tddData[task.name] = data;
            }
          } catch (e) {
            /* ignore missing files */
          }
        })
      );
    }

    cachedTddData = tddData;
    return tddData;
  } catch (err) {
    console.error('Failed to fetch TDD data:', err);
    return {};
  }
}

/**
 * Set connection status indicator
 */
export function setStatus(connected) {
  const circle = document.getElementById('status-circle');
  if (circle) {
    circle.classList.remove('connected', 'disconnected');
    circle.classList.add(connected ? 'connected' : 'disconnected');
  }
}

/**
 * Fetch board and progress data from JSON files
 * Returns true if data has changed since last fetch
 */
export async function fetchBoardData() {
  try {
    // Fetch both files from parent directory
    const [boardResponse, progressResponse] = await Promise.all([
      fetch('../kanban-board.json?' + Date.now()),
      fetch('../kanban-progress.json?' + Date.now()),
    ]);

    if (!boardResponse.ok) {
      throw new Error('Failed to fetch kanban-board.json');
    }

    const boardData = await boardResponse.json();
    let progressData = {};

    if (progressResponse.ok) {
      progressData = await progressResponse.json();
    }

    // Store cached data for external access
    cachedBoardData = boardData;
    cachedProgressData = progressData;

    // Check if data changed
    const boardStr = JSON.stringify(boardData);
    const progressStr = JSON.stringify(progressData);
    const hasChanged =
      boardStr !== lastBoardData || progressStr !== lastProgressData;

    if (hasChanged) {
      lastBoardData = boardStr;
      lastProgressData = progressStr;
    }

    setStatus(true);
    return hasChanged;
  } catch (err) {
    setStatus(false);
    console.error('Fetch error:', err);

    // Show error in board
    const titleEl = document.getElementById('project-title');
    const pendingEl = document.getElementById('tasks-pending');

    if (titleEl) titleEl.textContent = 'Error Loading Kanban';
    if (pendingEl) {
      pendingEl.innerHTML =
        '<div class="error-message">Could not load kanban-board.json<br>Run /kanban:create first</div>';
    }

    return false;
  }
}

/**
 * Legacy export for backwards compatibility
 * @deprecated Use fetchBoardData instead
 */
export const fetchAndRender = fetchBoardData;
