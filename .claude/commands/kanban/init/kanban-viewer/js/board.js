/**
 * Board rendering orchestration
 */

import { formatDate, formatTokens } from './formatters.js';
import { getTaskStatus, createTaskCard } from './tasks.js';

export function renderBoard(boardData, progressData) {
    const tasks = boardData.tasks || [];
    const progressObj = progressData || {};

    // Categorize tasks by status
    const pending = [];
    const blocked = [];
    const inProgress = [];
    const codeReview = [];
    const completed = [];

    tasks.forEach((task) => {
        const status = getTaskStatus(task, progressObj);
        switch (status) {
            case 'pending':
                pending.push(task);
                break;
            case 'blocked':
                blocked.push(task);
                break;
            case 'in-progress':
                inProgress.push(task);
                break;
            case 'code-review':
                codeReview.push(task);
                break;
            case 'completed':
                completed.push(task);
                break;
        }
    });

    // Calculate token statistics
    const taskTokenValues = [];
    tasks.forEach((task) => {
        const progress = progressObj[task.name];
        if (progress?.tokensUsed?.length > 0) {
            const finalTokens = progress.tokensUsed[progress.tokensUsed.length - 1];
            if (finalTokens > 0) {
                taskTokenValues.push(finalTokens);
            }
        }
    });

    const totalTokens = taskTokenValues.reduce((a, b) => a + b, 0);
    const minTokens = taskTokenValues.length > 0 ? Math.min(...taskTokenValues) : 0;
    const maxTokens = taskTokenValues.length > 0 ? Math.max(...taskTokenValues) : 0;
    const avgTokens = taskTokenValues.length > 0 ? Math.round(totalTokens / taskTokenValues.length) : 0;

    // Update header
    document.getElementById('project-title').textContent =
        boardData.project || 'Kanban Board';
    const projectTypeText = boardData.projectType ? `Project Type: ${boardData.projectType}` : '';
    const projectCreatedText = boardData.created ? `Created: ${formatDate(boardData.created)}` : '';
    document.getElementById('project-type').textContent = projectTypeText;
    document.getElementById('project-created').textContent = projectCreatedText;
    document.querySelector('.project-meta-separator').style.display =
        projectTypeText && projectCreatedText ? 'block' : 'none';

    // Update stats
    document.getElementById('stat-pending').textContent = pending.length;
    document.getElementById('stat-blocked').textContent = blocked.length;
    document.getElementById('stat-progress').textContent = inProgress.length;
    document.getElementById('stat-review').textContent = codeReview.length;
    document.getElementById('stat-completed').textContent = completed.length;
    document.getElementById('stat-min').textContent = formatTokens(minTokens);
    document.getElementById('stat-max').textContent = formatTokens(maxTokens);
    document.getElementById('stat-avg').textContent = formatTokens(avgTokens);
    document.getElementById('stat-tokens').textContent = formatTokens(totalTokens);

    // Update counts
    document.getElementById('count-pending').textContent = pending.length;
    document.getElementById('count-blocked').textContent = blocked.length;
    document.getElementById('count-progress').textContent = inProgress.length;
    document.getElementById('count-review').textContent = codeReview.length;
    document.getElementById('count-completed').textContent = completed.length;

    // Update progress bar
    const total = tasks.length;
    const progressPercent = total > 0 ? (completed.length / total) * 100 : 0;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;

    // Render tasks
    document.getElementById('tasks-pending').innerHTML =
        pending.length > 0
            ? pending
                .map((t) => createTaskCard(t, 'pending', progressObj[t.name]))
                .join('')
            : '<div class="empty-column">No pending tasks</div>';

    document.getElementById('tasks-blocked').innerHTML =
        blocked.length > 0
            ? blocked
                .map((t) => createTaskCard(t, 'blocked', progressObj[t.name]))
                .join('')
            : '<div class="empty-column">No tasks on hold</div>';

    document.getElementById('tasks-progress').innerHTML =
        inProgress.length > 0
            ? inProgress
                .map((t) =>
                    createTaskCard(t, 'in-progress', progressObj[t.name])
                )
                .join('')
            : '<div class="empty-column">No tasks in progress</div>';

    document.getElementById('tasks-review').innerHTML =
        codeReview.length > 0
            ? codeReview
                .map((t) =>
                    createTaskCard(t, 'code-review', progressObj[t.name])
                )
                .join('')
            : '<div class="empty-column">No tasks in review</div>';

    document.getElementById('tasks-completed').innerHTML =
        completed.length > 0
            ? completed
                .map((t) => createTaskCard(t, 'completed', progressObj[t.name]))
                .join('')
            : '<div class="empty-column">No completed tasks</div>';
}
