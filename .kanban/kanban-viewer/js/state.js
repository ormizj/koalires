/**
 * localStorage state management for column visibility
 */

const COLUMN_STATE_KEY = 'kanban-column-state';

export function getColumnState() {
    try {
        const state = localStorage.getItem(COLUMN_STATE_KEY);
        return state ? JSON.parse(state) : { minimized: [], maximized: null };
    } catch {
        return { minimized: [], maximized: null };
    }
}

export function saveColumnState(minimized, maximized) {
    try {
        localStorage.setItem(
            COLUMN_STATE_KEY,
            JSON.stringify({ minimized, maximized })
        );
    } catch {
        // localStorage not available
    }
}
