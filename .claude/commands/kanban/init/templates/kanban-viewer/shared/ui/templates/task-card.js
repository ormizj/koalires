/**
 * Task Card Template
 * Renders a task card for the board view
 */

import { escapeHtml } from '../../utils/dom.js';
import { formatRelativeTime, formatTokens } from '../../utils/format.js';
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
        <div class="task-description">${escapeHtml(task.description)}</div>
      </div>
    `
    : '';

  const stepsHtml = createStepsSection(task.steps, status);
  const affectedFilesHtml = createAffectedFilesSection(task.affectedFiles);
  const agentsHtml = createAgentsSection(task.agents, task.qaAgent);
  const logHtml = createLogSection(progress?.log);
  const timestampsHtml = createTimestampsSection(progress);
  const tokensHtml = createTokensSection(finalTokens);
  const filesChangedHtml = createFilesChangedSection(progress);

  return `
    <div class="task ${status}" data-task="${escapeHtml(task.name)}" onclick="openTaskModal('${escapeHtml(task.name)}')">
      <div class="task-header">
        <span class="task-name">${escapeHtml(task.name)}</span>
        ${categoryHtml}
      </div>
      ${descriptionHtml}
      ${stepsHtml}
      ${affectedFilesHtml}
      ${agentsHtml}
      ${logHtml}
      ${timestampsHtml}
      ${tokensHtml}
      ${filesChangedHtml}
    </div>
  `;
}

function createStepsSection(steps, status) {
  if (!steps || steps.length === 0) return '';

  const maxVisible = 3;
  const visibleSteps = steps.slice(0, maxVisible);
  const hiddenSteps = steps.slice(maxVisible);
  const hasMore = hiddenSteps.length > 0;

  let html = `
    <div class="task-steps">
      <div class="task-steps-label">Steps</div>
  `;

  visibleSteps.forEach((step) => {
    html += `<div class="task-step">${escapeHtml(step)}</div>`;
  });

  if (hasMore) {
    hiddenSteps.forEach((step) => {
      html += `<div class="task-step task-steps-hidden" style="display: none;">${escapeHtml(step)}</div>`;
    });
    html += `<div class="task-steps-collapsed">+${hiddenSteps.length} more steps...</div>`;
  }

  html += '</div>';
  return html;
}

function createAffectedFilesSection(files) {
  if (!files || files.length === 0) return '';

  const maxVisible = 3;
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

function createAgentsSection(agents, qaAgent) {
  if ((!agents || agents.length === 0) && !qaAgent) return '';

  let html = `
    <div class="task-agents">
      <div class="task-agents-label">Agents</div>
      <div class="task-agents-list">
  `;

  if (agents) {
    agents.forEach((agent) => {
      html += `<span class="task-agent">${escapeHtml(agent)}</span>`;
    });
  }

  if (qaAgent) {
    html += `<span class="task-agent task-agent-qa">${escapeHtml(qaAgent)}</span>`;
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
    html += `
      <div class="task-timestamp started">
        <span class="task-timestamp-icon">${getIcon('play', 12)}</span>
        ${formatRelativeTime(startedAt)}
      </div>
    `;
  }

  if (completedAt) {
    html += `
      <div class="task-timestamp completed">
        <span class="task-timestamp-icon">${getIcon('check', 12)}</span>
        ${formatRelativeTime(completedAt)}
      </div>
    `;
  }

  if (startedAt && completedAt) {
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end - start;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const remainMin = diffMin % 60;
    const duration =
      diffHour > 0 ? `${diffHour}h ${remainMin}m` : `${diffMin}m`;

    html += `
      <div class="task-timestamp duration">
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

  return `
    <div class="task-tokens ${severityClass}">
      <span class="task-tokens-icon">${getIcon('coin', 14)}</span>
      <span>${formattedTokens}</span>
      <div class="task-tokens-bar">
        <div class="task-tokens-fill" style="width: ${percentage}%"></div>
      </div>
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
