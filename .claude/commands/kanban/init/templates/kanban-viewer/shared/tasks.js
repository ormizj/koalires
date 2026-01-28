/**
 * Task utilities - status calculation and task manipulation
 */

/**
 * Calculate task status from task data and progress
 * @param {Object} task - Task object from board data
 * @param {Object} progressData - Progress data object
 * @returns {string} Task status: 'pending' | 'in-progress' | 'code-review' | 'completed' | 'blocked'
 */
export function getTaskStatus(task, progressData) {
  // Check for explicit blocked status first
  if (task.blocked) {
    return 'blocked';
  }

  const progress = progressData?.[task.name];

  // No progress data means pending
  if (!progress) {
    return 'pending';
  }

  // Check for code review status
  if (progress.codeReview || progress.status === 'code-review') {
    return 'code-review';
  }

  // Check for completed status
  if (progress.completedAt || progress.status === 'completed') {
    return 'completed';
  }

  // Check for in-progress status
  if (progress.startedAt || progress.status === 'in-progress') {
    return 'in-progress';
  }

  return 'pending';
}

/**
 * Get status display label
 * @param {string} status - Status code
 * @returns {string} Display label
 */
export function getStatusLabel(status) {
  const labels = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    'code-review': 'Code Review',
    completed: 'Completed',
    blocked: 'Hold',
  };
  return labels[status] || status;
}

/**
 * Get status CSS class
 * @param {string} status - Status code
 * @returns {string} CSS class name
 */
export function getStatusClass(status) {
  const classes = {
    pending: 'pending',
    'in-progress': 'in-progress',
    'code-review': 'code-review',
    completed: 'completed',
    blocked: 'blocked',
  };
  return classes[status] || 'pending';
}

/**
 * Sort tasks by status priority
 * @param {Array} tasks - Array of tasks
 * @param {Object} progressData - Progress data
 * @returns {Array} Sorted tasks
 */
export function sortTasksByStatus(tasks, progressData) {
  const statusOrder = {
    'in-progress': 0,
    'code-review': 1,
    blocked: 2,
    pending: 3,
    completed: 4,
  };

  return [...tasks].sort((a, b) => {
    const statusA = getTaskStatus(a, progressData);
    const statusB = getTaskStatus(b, progressData);
    return (statusOrder[statusA] || 5) - (statusOrder[statusB] || 5);
  });
}

/**
 * Group tasks by status
 * @param {Array} tasks - Array of tasks
 * @param {Object} progressData - Progress data
 * @returns {Object} Tasks grouped by status
 */
export function groupTasksByStatus(tasks, progressData) {
  const groups = {
    pending: [],
    blocked: [],
    'in-progress': [],
    'code-review': [],
    completed: [],
  };

  tasks.forEach((task) => {
    const status = getTaskStatus(task, progressData);
    if (groups[status]) {
      groups[status].push(task);
    }
  });

  return groups;
}

/**
 * Filter tasks by search query
 * @param {Array} tasks - Array of tasks
 * @param {string} query - Search query
 * @returns {Array} Filtered tasks
 */
export function filterTasksBySearch(tasks, query) {
  if (!query || query.trim() === '') {
    return tasks;
  }

  const lowerQuery = query.toLowerCase().trim();

  return tasks.filter((task) => {
    // Search in name
    if (task.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in category
    if (task.category && task.category.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in description
    if (
      task.description &&
      task.description.toLowerCase().includes(lowerQuery)
    ) {
      return true;
    }

    // Search in steps
    if (task.steps) {
      const stepsMatch = task.steps.some((step) =>
        step.toLowerCase().includes(lowerQuery)
      );
      if (stepsMatch) return true;
    }

    // Search in affected files
    if (task.affectedFiles) {
      const filesMatch = task.affectedFiles.some((file) =>
        file.toLowerCase().includes(lowerQuery)
      );
      if (filesMatch) return true;
    }

    return false;
  });
}
