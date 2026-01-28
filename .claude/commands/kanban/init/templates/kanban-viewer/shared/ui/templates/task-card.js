/**
 * Task Card Template
 * Renders a task card for the board view
 */

import { escapeHtml } from '../../utils/dom.js';
import { formatRelativeTime, formatTokens, parseMarkdown } from '../../utils/format.js';
import { getIcon } from '../../utils/icons.js';
import { getCategoryClass } from '../components/CategoryBadge.js';

/**
 * Create task card HTML
 * @param {Object} task - Task object
 * @param {Object} progress - Progress data for this task
 * @param {string} status - Task status
 * @returns {string} HTML string
 */
export function createTaskCard(task, progress, status) {
  const categoryClass = getCategoryClass(task.category);
  const tokensUsed = progress?.tokensUsed || [];
  const finalTokens =
    tokensUsed.length > 0 ? tokensUsed[tokensUsed.length - 1] : 0;

  // Build sections
  const categoryHtml = task.category
    ? `<span class="task-category ${categoryClass}">${escapeHtml(task.category)}</span>`
    : '';

  const descriptionHtml = task.description
    ? `
      <div class="task-description-section">
        <div class="task-description-label">Description</div>
        <div class="task-description">${parseMarkdown(task.description)}</div>
      </div>
    `
    : '';

  const stepsHtml = createStepsSection(task.steps, status);
  const stepsSummaryHtml = createStepsSummarySection(task.steps);
  const workLogSummaryHtml = createWorkLogSummarySection(progress?.workLog);
  const affectedFilesHtml = createAffectedFilesSection(progress?.affectedFiles);
  const agentsHtml = createAgentsSection(progress?.agent, progress?.tddAgent);
  const logHtml = createLogSection(progress?.workLog);
  const timestampsHtml = createTimestampsSection(progress);
  const tokensHtml = createTokensSection(finalTokens);
  const filesChangedHtml = createFilesChangedSection(progress);

  // Check if there's content below the separator
  const hasBottomDetails = timestampsHtml || tokensHtml || agentsHtml || affectedFilesHtml || filesChangedHtml;

  // Build summary badges (hidden when expanded)
  const hasBadges = stepsSummaryHtml || workLogSummaryHtml;
  const badgesHtml = hasBadges
    ? `<div class="task-summary-badges">${stepsSummaryHtml}${workLogSummaryHtml}</div>`
    : '';

  // Check if there are ANY details to show
  // Note: badges are hidden when expanded, so only show details section if there's bottom content
  const hasAnyDetails = hasBottomDetails;

  return `
    <div class="task ${status}" data-task-name="${escapeHtml(task.name)}" onclick="openTaskModal('${escapeHtml(task.name)}')">
      <div class="task-header">
        <span class="task-name">${escapeHtml(task.name)}</span>
        ${categoryHtml}
      </div>

      <div class="task-main-content${!hasAnyDetails ? ' no-details' : ''}">
        ${descriptionHtml}
        ${stepsHtml}
        ${logHtml}
      </div>

      ${hasAnyDetails ? `
      <div class="task-details">
        <div class="task-details-header">
          <div class="task-details-divider"></div>
          <span class="task-details-label">Details</span>
          <div class="task-details-divider"></div>
        </div>
        ${badgesHtml}
        ${hasBadges && hasBottomDetails ? '<div class="task-details-separator"></div>' : ''}
        ${timestampsHtml}
        ${tokensHtml}
        ${agentsHtml}
        ${affectedFilesHtml}
        ${filesChangedHtml}
      </div>
      ` : ''}
    </div>
  `;
}

function createStepsSection(steps, status) {
  if (!steps || steps.length === 0) return '';

  let html = `
    <div class="task-steps">
      <div class="task-steps-label">Steps</div>
  `;

  steps.forEach((step) => {
    html += `<div class="task-step">${escapeHtml(step)}</div>`;
  });

  html += '</div>';
  return html;
}

function createStepsSummarySection(steps) {
  if (!steps || steps.length === 0) return '';

  return `
    <div class="task-summary-badge">
      ${getIcon('list', 12)}
      <span>${steps.length} Verification Step${steps.length !== 1 ? 's' : ''}</span>
    </div>
  `;
}

function createWorkLogSummarySection(workLog) {
  if (!workLog || workLog.length === 0) return '';

  return `
    <div class="task-summary-badge">
      ${getIcon('file', 12)}
      <span>${workLog.length} Work Log${workLog.length !== 1 ? 's' : ''}</span>
    </div>
  `;
}

function createAffectedFilesSection(files) {
  if (!files || files.length === 0) return '';

  // 1-3 files: show all, 4+ files: show 2 + "X more"
  const maxVisible = files.length <= 3 ? 3 : 2;
  const visibleFiles = files.slice(0, maxVisible);

  let html = `
    <div class="task-affected-files">
      <div class="task-affected-files-label">Affected Files</div>
  `;

  visibleFiles.forEach((file) => {
    html += `<div class="task-affected-file">${escapeHtml(file)}</div>`;
  });

  if (files.length > maxVisible) {
    html += `<div class="task-affected-file">+${files.length - maxVisible} more...</div>`;
  }

  html += '</div>';
  return html;
}

function createAgentsSection(agent, tddAgent) {
  if (!agent && !tddAgent) return '';

  let html = `
    <div class="task-agents">
      <div class="task-agents-label">Agents</div>
      <div class="task-agents-list">
  `;

  if (agent) {
    html += `<span class="task-agent">${escapeHtml(agent)}</span>`;
  }

  if (tddAgent) {
    html += `<span class="task-agent task-agent-qa">${escapeHtml(tddAgent)}</span>`;
  }

  html += '</div></div>';
  return html;
}

function createLogSection(log) {
  if (!log || log.length === 0) return '';

  let html = `
    <div class="task-log">
      <div class="task-log-label">Activity Log</div>
      <div class="task-log-content">
        <ul class="task-log-list">
  `;

  log.forEach((entry) => {
    html += `<li class="task-log-item">${escapeHtml(entry)}</li>`;
  });

  html += '</ul></div></div>';
  return html;
}

function createTimestampsSection(progress) {
  if (!progress) return '';

  const { startedAt, completedAt } = progress;
  if (!startedAt && !completedAt) return '';

  let html = '<div class="task-timestamps">';

  if (startedAt) {
    const startDate = new Date(startedAt).toLocaleString();
    html += `
      <div class="task-timestamp started" title="Started: ${startDate}">
        <span class="task-timestamp-icon">${getIcon('play', 12)}</span>
        ${formatRelativeTime(startedAt)}
      </div>
    `;
  }

  if (completedAt) {
    const completeDate = new Date(completedAt).toLocaleString();
    html += `
      <div class="task-timestamp completed" title="Completed: ${completeDate}">
        <span class="task-timestamp-icon">${getIcon('check', 12)}</span>
        ${formatRelativeTime(completedAt)}
      </div>
    `;
  }

  if (startedAt && completedAt) {
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end - start;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHour / 24);
    const remainHour = diffHour % 24;
    const remainMin = diffMin % 60;
    const remainSec = diffSec % 60;
    const duration =
      diffHour > 0 ? `${diffHour}h ${remainMin}m` : `${diffMin}m`;
    let durationFull;
    if (diffDays > 0) {
      durationFull = `${diffDays}:${String(remainHour).padStart(2, '0')}:${String(remainMin).padStart(2, '0')}:${String(remainSec).padStart(2, '0')}`;
    } else if (remainHour > 0) {
      durationFull = `${String(remainHour).padStart(2, '0')}:${String(remainMin).padStart(2, '0')}:${String(remainSec).padStart(2, '0')}`;
    } else {
      durationFull = `${String(remainMin).padStart(2, '0')}:${String(remainSec).padStart(2, '0')}`;
    }

    html += `
      <div class="task-timestamp duration" title="Duration: ${durationFull}">
        <span class="task-timestamp-icon">${getIcon('clock', 12)}</span>
        ${duration}
      </div>
    `;
  }

  html += '</div>';
  return html;
}

function createTokensSection(tokens) {
  if (!tokens || tokens === 0) return '';

  const formattedTokens = formatTokens(tokens);
  const percentage = Math.min((tokens / 200000) * 100, 100);
  let severityClass = '';

  if (percentage >= 90) {
    severityClass = 'danger';
  } else if (percentage >= 70) {
    severityClass = 'warning';
  }

  const percentColor = percentage >= 90 ? '#f85149' : percentage >= 70 ? '#f0883e' : '#58a6ff';

  return `
    <div class="task-tokens ${severityClass}" title="Tokens used: ${tokens.toLocaleString()}">
      <span class="task-tokens-icon">${getIcon('coin', 14)}</span>
      <span>${formattedTokens}</span>
      <div class="task-tokens-bar">
        <div class="task-tokens-fill" style="width: ${percentage}%"></div>
      </div>
      <span class="task-tokens-percent" style="color: ${percentColor};">${percentage.toFixed(1)}%</span>
    </div>
  `;
}

function createFilesChangedSection(progress) {
  const created = progress?.filesCreated || [];
  const modified = progress?.filesModified || [];

  if (created.length === 0 && modified.length === 0) return '';

  let html = '';

  if (created.length > 0) {
    html += `
      <div class="task-files-section">
        <div class="task-files-label created">${getIcon('plus', 12)} Files Created</div>
    `;
    created.slice(0, 3).forEach((file) => {
      html += `<div class="task-file created">${escapeHtml(file)}</div>`;
    });
    if (created.length > 3) {
      html += `<div class="task-file">+${created.length - 3} more...</div>`;
    }
    html += '</div>';
  }

  if (modified.length > 0) {
    html += `
      <div class="task-files-section">
        <div class="task-files-label modified">${getIcon('file', 12)} Files Modified</div>
    `;
    modified.slice(0, 3).forEach((file) => {
      html += `<div class="task-file modified">${escapeHtml(file)}</div>`;
    });
    if (modified.length > 3) {
      html += `<div class="task-file">+${modified.length - 3} more...</div>`;
    }
    html += '</div>';
  }

  return html;
}
