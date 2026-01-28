/**
 * Board View Controller - manages kanban board rendering
 */

import { formatDate, formatTokens } from '../../shared/utils/format.js';
import { getTaskStatus } from '../../shared/tasks.js';
import { createTaskCard } from '../../shared/ui/templates/task-card.js';
import { reapplySearch } from '../search/index.js';
import { applyAutoCollapseAll } from './columns.js';

// Token display mode: 'worker', 'tdd', or 'combined'
const TOKEN_MODES = ['combined', 'worker', 'tdd'];
const TOKEN_MODE_STORAGE_KEY = 'kanban-viewer-token-mode';

// Initialize from localStorage
function getInitialTokenModeIndex() {
  const savedMode = localStorage.getItem(TOKEN_MODE_STORAGE_KEY);
  if (savedMode) {
    const index = TOKEN_MODES.indexOf(savedMode);
    if (index !== -1) return index;
  }
  return 0;
}

let currentTokenModeIndex = getInitialTokenModeIndex();

/**
 * Get current token display mode
 */
export function getTokenMode() {
  return TOKEN_MODES[currentTokenModeIndex];
}

/**
 * Set token display mode directly
 * @param {string} mode - 'combined', 'worker', or 'tdd'
 * @returns {string} The set mode
 */
export function setTokenMode(mode) {
  const index = TOKEN_MODES.indexOf(mode);
  if (index !== -1) {
    currentTokenModeIndex = index;
    localStorage.setItem(TOKEN_MODE_STORAGE_KEY, mode);
  }
  return mode;
}

export const boardView = {
  // Store current data for recalculation
  _currentTasks: [],
  _currentProgressObj: {},
  _currentTddDataObj: {},

  /**
   * Render the kanban board with tasks categorized by status
   * @param {Object} boardData - Board data from kanban-board.json
   * @param {Object} progressData - Progress data from kanban-progress.json
   * @param {Object} tddData - TDD/QA token data from test-creation-output files
   */
  render(boardData, progressData, tddData = {}) {
    const tasks = boardData?.tasks || [];
    const progressObj = progressData || {};
    const tddDataObj = tddData || {};

    // Store for recalculation
    this._currentTasks = tasks;
    this._currentProgressObj = progressObj;
    this._currentTddDataObj = tddDataObj;

    // Categorize tasks by status
    const columns = {
      pending: [],
      blocked: [],
      progress: [],
      review: [],
      completed: [],
    };

    tasks.forEach((task) => {
      const status = getTaskStatus(task, progressObj);
      switch (status) {
        case 'pending':
          columns.pending.push(task);
          break;
        case 'blocked':
          columns.blocked.push(task);
          break;
        case 'in-progress':
          columns.progress.push(task);
          break;
        case 'code-review':
          columns.review.push(task);
          break;
        case 'completed':
          columns.completed.push(task);
          break;
      }
    });

    // Calculate token statistics with current mode
    const mode = getTokenMode();
    const tokenStats = this._calculateTokenStats(
      tasks,
      progressObj,
      tddDataObj,
      mode
    );

    // Update header
    this._updateHeader(boardData);

    // Render each column
    this._renderColumn('pending', columns.pending, progressObj);
    this._renderColumn('blocked', columns.blocked, progressObj);
    this._renderColumn('progress', columns.progress, progressObj);
    this._renderColumn('review', columns.review, progressObj);
    this._renderColumn('completed', columns.completed, progressObj);

    // Update counts and stats
    this._updateCounts(columns);
    this._updateTokenStats(tokenStats, mode);
    this._updateProgressBar(columns, tasks.length);

    // Re-apply search filter after render
    reapplySearch();

    // Apply auto-collapse based on task counts
    applyAutoCollapseAll();
  },

  _renderColumn(columnId, tasks, progressObj) {
    const container = document.getElementById(`tasks-${columnId}`);
    if (!container) return;

    const emptyMessages = {
      pending: 'No pending tasks',
      blocked: 'No tasks on hold',
      progress: 'No tasks in progress',
      review: 'No tasks in review',
      completed: 'No completed tasks',
    };

    if (tasks.length === 0) {
      container.innerHTML = `<div class="empty-column">${emptyMessages[columnId]}</div>`;
      return;
    }

    const statusMap = {
      pending: 'pending',
      blocked: 'blocked',
      progress: 'in-progress',
      review: 'code-review',
      completed: 'completed',
    };

    container.innerHTML = tasks
      .map((task) =>
        createTaskCard(task, statusMap[columnId], progressObj[task.name])
      )
      .join('');
  },

  /**
   * Calculate token statistics for tasks
   * @param {Array} tasks - Task list
   * @param {Object} progressObj - Progress data from kanban-progress.json
   * @param {Object} tddDataObj - TDD/QA data from test-creation-output files
   * @param {string} mode - 'worker', 'tdd', or 'combined'
   */
  _calculateTokenStats(tasks, progressObj, tddDataObj = {}, mode = 'combined') {
    const workerTokens = [];
    const tddTokens = [];

    tasks.forEach((task) => {
      // Worker tokens from progress
      const progress = progressObj[task.name];
      if (progress?.tokensUsed?.length > 0) {
        const finalTokens = progress.tokensUsed[progress.tokensUsed.length - 1];
        if (finalTokens > 0) {
          workerTokens.push(finalTokens);
        }
      }

      // TDD tokens from tddData
      const tddProgress = tddDataObj[task.name];
      if (tddProgress?.tokensUsed?.length > 0) {
        const finalTokens =
          tddProgress.tokensUsed[tddProgress.tokensUsed.length - 1];
        if (finalTokens > 0) {
          tddTokens.push(finalTokens);
        }
      }
    });

    // Helper to calculate stats from an array
    const calc = (arr) => ({
      total: arr.reduce((a, b) => a + b, 0),
      min: arr.length > 0 ? Math.min(...arr) : 0,
      max: arr.length > 0 ? Math.max(...arr) : 0,
      avg: arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0,
    });

    switch (mode) {
      case 'worker':
        return calc(workerTokens);
      case 'tdd':
        return calc(tddTokens);
      case 'combined':
      default:
        return calc([...workerTokens, ...tddTokens]);
    }
  },

  /**
   * Recalculate and update token stats with the given mode
   * Called when token mode changes
   */
  recalculateTokenStats() {
    const mode = getTokenMode();
    const tokenStats = this._calculateTokenStats(
      this._currentTasks,
      this._currentProgressObj,
      this._currentTddDataObj,
      mode
    );
    this._updateTokenStats(tokenStats, mode);
  },

  _updateHeader(boardData) {
    const titleEl = document.getElementById('project-title');
    const typeEl = document.getElementById('project-type');
    const createdEl = document.getElementById('project-created');
    const separatorEl = document.querySelector('.project-meta-separator');

    if (titleEl) {
      titleEl.textContent = boardData?.project || 'Kanban Board';
    }

    const projectTypeText = boardData?.projectType
      ? `Project Type: ${boardData.projectType}`
      : '';
    const projectCreatedText = boardData?.created
      ? `Created: ${formatDate(boardData.created)}`
      : '';

    if (typeEl) typeEl.textContent = projectTypeText;
    if (createdEl) createdEl.textContent = projectCreatedText;
    if (separatorEl) {
      separatorEl.style.display =
        projectTypeText && projectCreatedText ? 'block' : 'none';
    }
  },

  _updateCounts(columns) {
    // Update stat counts
    const statElements = {
      pending: document.getElementById('stat-pending'),
      blocked: document.getElementById('stat-blocked'),
      progress: document.getElementById('stat-progress'),
      review: document.getElementById('stat-review'),
      completed: document.getElementById('stat-completed'),
    };

    // Update column counts
    const countElements = {
      pending: document.getElementById('count-pending'),
      blocked: document.getElementById('count-blocked'),
      progress: document.getElementById('count-progress'),
      review: document.getElementById('count-review'),
      completed: document.getElementById('count-completed'),
    };

    Object.entries(columns).forEach(([key, tasks]) => {
      if (statElements[key]) {
        statElements[key].textContent = tasks.length;
      }
      if (countElements[key]) {
        countElements[key].textContent = tasks.length;
      }
    });
  },

  _updateTokenStats(stats, mode = 'combined') {
    const elements = {
      min: document.getElementById('stat-min'),
      max: document.getElementById('stat-max'),
      avg: document.getElementById('stat-avg'),
      total: document.getElementById('stat-tokens'),
    };

    if (elements.min) elements.min.textContent = formatTokens(stats.min);
    if (elements.max) elements.max.textContent = formatTokens(stats.max);
    if (elements.avg) elements.avg.textContent = formatTokens(stats.avg);
    if (elements.total) elements.total.textContent = formatTokens(stats.total);

    // Update segmented control active state
    const selector = document.getElementById('token-mode-selector');
    if (selector) {
      selector.querySelectorAll('.token-mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
    }
  },

  _updateProgressBar(columns, total) {
    const completed = columns.completed.length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }
  },
};
