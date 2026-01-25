/**
 * Task status logic and card rendering
 */

import {
  escapeHtml,
  parseMarkdown,
  formatDate,
  formatRelativeTime,
  calculateDuration,
} from './formatters.js';

/**
 * Determine task status based on progress data
 * New format: progress.status takes precedence ("completed", "blocked", "running")
 * Fallback to old logic for backwards compatibility
 */
export function getTaskStatus(task, progressData) {
  const progress = progressData[task.name];

  // Direct status from progress takes precedence
  if (progress?.status === 'completed') {
    return 'completed';
  }
  if (progress?.status === 'blocked') {
    return 'blocked';
  }
  if (progress?.status === 'code-review') {
    return 'code-review';
  }
  if (progress?.status === 'running') {
    return 'in-progress';
  }

  // Fallback to old logic for backwards compatibility
  const isStarted = !!progress;
  const isPassed = task.passes === true;
  const isCommitted = progress?.committed === true;

  if (isPassed && isCommitted) {
    return 'completed';
  }
  if (isPassed && !isCommitted) {
    return 'code-review';
  }
  if (task.status === 'code-review') {
    return 'code-review';
  }
  if (isStarted) {
    return 'in-progress';
  }
  return 'pending';
}

/**
 * Generate HTML for a task card
 */
export function createTaskCard(task, status, progressEntry) {
  const stepsHtml =
    task.steps && task.steps.length > 0
      ? (() => {
          const steps = task.steps;
          const VISIBLE_FIRST = 4;
          const SHOW_LAST = 1;
          const THRESHOLD = VISIBLE_FIRST + SHOW_LAST + 1; // 6 steps to trigger collapse

          if (steps.length <= THRESHOLD) {
            // Show all steps if under threshold
            return `
                    <div class="task-steps">
                        <div class="task-steps-label">Verification Steps:</div>
                        ${steps.map((s) => `<div class="task-step">${escapeHtml(s)}</div>`).join('')}
                    </div>
                `;
          }

          // Show first 4, collapsed indicator, last 1
          const firstSteps = steps.slice(0, VISIBLE_FIRST);
          const lastStep = steps[steps.length - 1];
          const hiddenCount = steps.length - VISIBLE_FIRST - SHOW_LAST;

          return `
                <div class="task-steps">
                    <div class="task-steps-label">Verification Steps:</div>
                    ${firstSteps.map((s) => `<div class="task-step">${escapeHtml(s)}</div>`).join('')}
                    <div class="task-steps-collapsed">
                        ${hiddenCount} more step${hiddenCount > 1 ? 's' : ''}...
                    </div>
                    <div class="task-steps-hidden" style="display: none;">
                        ${steps
                          .slice(VISIBLE_FIRST, -SHOW_LAST)
                          .map(
                            (s) =>
                              `<div class="task-step">${escapeHtml(s)}</div>`
                          )
                          .join('')}
                    </div>
                    <div class="task-step">${escapeHtml(lastStep)}</div>
                </div>
            `;
        })()
      : '';

  // Handle affectedFiles (new format) or filesCreated/filesModified (old format)
  const affectedFiles = progressEntry?.affectedFiles || [];
  const filesCreated = progressEntry?.filesCreated || [];
  const filesModified = progressEntry?.filesModified || [];

  let filesHtml = '';

  // New format: single affectedFiles array
  if (affectedFiles.length > 0) {
    filesHtml = `
        <div class="task-files-section">
          <div class="task-files-label">Affected Files (${affectedFiles.length}):</div>
          ${affectedFiles.map((f) => `<div class="task-file">${escapeHtml(f)}</div>`).join('')}
        </div>
      `;
  } else {
    // Fallback to old format for backwards compatibility
    if (filesCreated.length > 0) {
      filesHtml += `
          <div class="task-files-section">
            <div class="task-files-label created">Files Created (${filesCreated.length}):</div>
            ${filesCreated.map((f) => `<div class="task-file created">${escapeHtml(f)}</div>`).join('')}
          </div>
        `;
    }
    if (filesModified.length > 0) {
      filesHtml += `
          <div class="task-files-section">
            <div class="task-files-label modified">Files Modified (${filesModified.length}):</div>
            ${filesModified.map((f) => `<div class="task-file modified">${escapeHtml(f)}</div>`).join('')}
          </div>
        `;
    }
  }

  // Handle agent as string (new format) or array (old format for backwards compat)
  const agentData = progressEntry?.agent;
  let agentsHtml = '';

  if (agentData) {
    if (typeof agentData === 'string') {
      // New format: single agent string
      agentsHtml = `
          <div class="task-agents">
            <div class="task-agents-label">Agent:</div>
            <div class="task-agents-list">
              <span class="task-agent">${escapeHtml(agentData)}</span>
            </div>
          </div>
        `;
    } else if (Array.isArray(agentData) && agentData.length > 0) {
      // Old format: array of agents
      agentsHtml = `
          <div class="task-agents">
            <div class="task-agents-label">Agents (${agentData.length}):</div>
            <div class="task-agents-list">
              ${agentData.map((a) => `<span class="task-agent">${escapeHtml(a)}</span>`).join('')}
            </div>
          </div>
        `;
    }
  }

  // Handle workLog as array
  const workLog = progressEntry?.workLog || [];
  const logHtml =
    workLog.length > 0
      ? `
    <div class="task-log">
      <div class="task-log-label">Work Log (${workLog.length} entries):</div>
      <div class="task-log-content">
        <ul class="task-log-list">
          ${workLog.map((entry) => `<li class="task-log-item">${escapeHtml(entry)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `
      : '';

  // Handle timestamps
  const startedAt = progressEntry?.startedAt;
  const completedAt = progressEntry?.completedAt;
  const duration = calculateDuration(startedAt, completedAt);

  let timestampsHtml = '';
  if (startedAt || completedAt) {
    timestampsHtml = '<div class="task-timestamps">';
    if (startedAt) {
      timestampsHtml += `
            <div class="task-timestamp started" title="Started: ${formatDate(startedAt)}">
              <svg class="task-timestamp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              Started ${formatRelativeTime(startedAt)}
            </div>
          `;
    }
    if (completedAt) {
      timestampsHtml += `
            <div class="task-timestamp completed" title="Completed: ${formatDate(completedAt)}">
              <svg class="task-timestamp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
              Completed ${formatRelativeTime(completedAt)}
            </div>
          `;
    }
    if (duration) {
      timestampsHtml += `
            <div class="task-timestamp duration" title="Duration">
              <svg class="task-timestamp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 12,12"/>
                <line x1="12" y1="12" x2="16" y2="12"/>
              </svg>
              ${duration}
            </div>
          `;
    }
    timestampsHtml += '</div>';
  }

  // Handle token usage
  const tokensUsed = progressEntry?.tokensUsed || [];
  const finalTokens =
    tokensUsed.length > 0 ? tokensUsed[tokensUsed.length - 1] : 0;
  const tokenLimit = 200000;
  const tokenPercent =
    finalTokens > 0 ? ((finalTokens / tokenLimit) * 100).toFixed(1) : 0;
  const tokenWarningClass =
    tokenPercent > 75 ? (tokenPercent > 90 ? 'danger' : 'warning') : '';

  let tokensHtml = '';
  if (finalTokens > 0) {
    tokensHtml = `
        <div class="task-tokens ${tokenWarningClass}">
          <svg class="task-tokens-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M9 12h6"/>
          </svg>
          <span>${finalTokens.toLocaleString()} / ${tokenLimit.toLocaleString()} (${tokenPercent}%)</span>
          <div class="task-tokens-bar">
            <div class="task-tokens-fill" style="width: ${tokenPercent}%"></div>
          </div>
        </div>
      `;
  }

  const completedClass = status === 'completed' ? 'completed' : '';

  return `
    <div class="task ${completedClass}" data-task-name="${escapeHtml(task.name)}" onclick="this.classList.toggle('expanded')">
      <div class="task-header">
        <span class="task-name">${escapeHtml(task.name)}</span>
        <span class="task-category category-${task.category}">${escapeHtml(task.category)}</span>
      </div>
      ${timestampsHtml}
      ${tokensHtml}
      <div class="task-description-section">
        <div class="task-description-label">Description:</div>
        <div class="task-description">${parseMarkdown(task.description || '')}</div>
      </div>
      ${logHtml}
      ${stepsHtml}
      ${filesHtml}
      ${agentsHtml}
    </div>
  `;
}
