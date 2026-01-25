/**
 * Data fetching and auto-refresh logic
 */

import { renderBoard } from './board.js';

let lastBoardData = null;
let lastProgressData = null;

export function setStatus(connected) {
    const circle = document.getElementById('status-circle');
    circle.classList.remove('connected', 'disconnected');
    circle.classList.add(connected ? 'connected' : 'disconnected');
}

export async function fetchAndRender() {
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

        const boardStr = JSON.stringify(boardData);
        const progressStr = JSON.stringify(progressData);

        if (boardStr !== lastBoardData || progressStr !== lastProgressData) {
            lastBoardData = boardStr;
            lastProgressData = progressStr;
            renderBoard(boardData, progressData);
        }

        setStatus(true);
    } catch (err) {
        setStatus(false);
        console.error('Fetch error:', err);

        // Show error in board
        document.getElementById('project-title').textContent =
            'Error Loading Kanban';
        document.getElementById('tasks-pending').innerHTML =
            '<div class="error-message">Could not load kanban-board.json<br>Run /kanban:create first</div>';
    }
}
