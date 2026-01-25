/**
 * Metadata modal for viewing task JSON data
 */

let modalElement = null;
let overlayElement = null;
let currentTaskName = null;

// Cached data
let boardDataCache = null;
let progressDataCache = null;
const logDataCache = new Map();
const outputDataCache = new Map();

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let modalStartX = 0;
let modalStartY = 0;

// Resize state
let isResizing = false;
let resizeDirection = '';
let resizeStartX = 0;
let resizeStartY = 0;
let modalStartWidth = 0;
let modalStartHeight = 0;
let modalStartLeft = 0;
let modalStartTop = 0;

const MIN_WIDTH = 500;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 600;
const MODAL_SIZE_KEY = 'kanban-metadata-modal-size';

// Auto-refresh state
let refreshInterval = null;
let currentTabData = null;
let currentTabName = null;

// Search state
let searchDebounceTimer = null;

/**
 * Initialize metadata modal event listeners
 */
export function initMetadataModal() {
    modalElement = document.getElementById('metadata-modal');
    overlayElement = document.getElementById('metadata-modal-overlay');

    if (!modalElement || !overlayElement) return;

    // Tab switching
    modalElement.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Skip if tab is disabled
            if (tab.classList.contains('disabled')) return;
            switchTab(tab.dataset.tab);
        });
    });

    // Close button
    modalElement.querySelector('.modal-close')?.addEventListener('click', hideModal);

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlayElement && !overlayElement.classList.contains('hidden')) {
            hideModal();
        }
    });

    // Drag handling
    const header = modalElement.querySelector('.modal-header');
    header?.addEventListener('mousedown', startDrag);

    // Resize handles
    modalElement.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', startResize);
    });

    // Global mouse events for drag/resize
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Initialize search
    initSearch();
}

/**
 * Show the modal for a specific task
 */
export function showModal(taskName) {
    if (!modalElement || !overlayElement) return;

    currentTaskName = taskName;

    // Update modal title
    const titleElement = modalElement.querySelector('.modal-title');
    if (titleElement) {
        titleElement.textContent = `Metadata: ${taskName}`;
    }

    // Show overlay and modal
    overlayElement.classList.remove('hidden');

    // Reset modal position to center
    centerModal();

    // Clear search
    const searchInput = document.getElementById('metadata-search');
    if (searchInput) {
        searchInput.value = '';
    }
    updateSearchCount(null);

    // Check which tabs have data available
    checkTabDataAvailability();

    // Load default tab (board)
    switchTab('board');

    // Start auto-refresh polling
    startRefreshPolling();
}

/**
 * Hide the modal
 */
export function hideModal() {
    // Stop auto-refresh polling
    stopRefreshPolling();

    if (overlayElement) {
        overlayElement.classList.add('hidden');
    }
    currentTaskName = null;
    currentTabData = null;
    currentTabName = null;
}

/**
 * Clear cached data (call on board refresh)
 */
export function clearCache() {
    boardDataCache = null;
    progressDataCache = null;
    logDataCache.clear();
    outputDataCache.clear();
}

/**
 * Check which tabs have data available and update their disabled state
 */
async function checkTabDataAvailability() {
    if (!modalElement || !currentTaskName) return;

    const tabs = {
        board: modalElement.querySelector('[data-tab="board"]'),
        progress: modalElement.querySelector('[data-tab="progress"]'),
        log: modalElement.querySelector('[data-tab="log"]'),
        output: modalElement.querySelector('[data-tab="output"]')
    };

    // Check each data source
    const availability = {
        board: false,
        progress: false,
        log: false,
        output: false
    };

    // Check board data
    try {
        const boardData = await fetchBoardData();
        availability.board = boardData !== null;
    } catch {
        availability.board = false;
    }

    // Check progress data
    try {
        const progressData = await fetchProgressData();
        availability.progress = progressData !== null;
    } catch {
        availability.progress = false;
    }

    // Check log data (worker-raw)
    try {
        const response = await fetch(`../logs/${currentTaskName}.json?t=${Date.now()}`);
        availability.log = response.ok;
    } catch {
        availability.log = false;
    }

    // Check output data (worker-output)
    try {
        const response = await fetch(`../logs/${currentTaskName}-output.json?t=${Date.now()}`);
        availability.output = response.ok;
    } catch {
        availability.output = false;
    }

    // Update tab disabled states
    Object.entries(tabs).forEach(([tabName, tabElement]) => {
        if (tabElement) {
            if (availability[tabName]) {
                tabElement.classList.remove('disabled');
            } else {
                tabElement.classList.add('disabled');
            }
        }
    });

    return availability;
}

/**
 * Save modal size to localStorage
 */
function saveModalSize() {
    if (!modalElement) return;

    const size = {
        width: modalElement.offsetWidth,
        height: modalElement.offsetHeight
    };

    try {
        localStorage.setItem(MODAL_SIZE_KEY, JSON.stringify(size));
    } catch (e) {
        // Ignore localStorage errors
    }
}

/**
 * Load modal size from localStorage
 */
function loadModalSize() {
    try {
        const stored = localStorage.getItem(MODAL_SIZE_KEY);
        if (stored) {
            const size = JSON.parse(stored);
            return {
                width: Math.max(MIN_WIDTH, size.width || DEFAULT_WIDTH),
                height: Math.max(MIN_HEIGHT, size.height || DEFAULT_HEIGHT)
            };
        }
    } catch (e) {
        // Ignore localStorage errors
    }
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

/**
 * Center the modal on screen
 */
function centerModal() {
    if (!modalElement) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const size = loadModalSize();

    modalElement.style.width = `${size.width}px`;
    modalElement.style.height = `${size.height}px`;
    modalElement.style.left = `${(viewportWidth - size.width) / 2}px`;
    modalElement.style.top = `${(viewportHeight - size.height) / 2}px`;
}

/**
 * Switch between tabs
 */
async function switchTab(tabName) {
    if (!modalElement) return;

    currentTabName = tabName;

    // Update tab active state
    modalElement.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Show loading state
    const contentElement = modalElement.querySelector('.modal-content');
    if (contentElement) {
        contentElement.innerHTML = '<div class="modal-loading">Loading...</div>';
    }

    // Clear search when switching tabs
    const searchInput = document.getElementById('metadata-search');
    if (searchInput) {
        searchInput.value = '';
    }
    updateSearchCount(null);

    // Fetch and display data based on tab
    const data = await fetchTabData(tabName);
    currentTabData = data;

    // Display the data
    renderTabContent(data);
}

/**
 * Fetch data for a specific tab
 */
async function fetchTabData(tabName) {
    try {
        switch (tabName) {
            case 'progress':
                return await fetchProgressData();
            case 'board':
                return await fetchBoardData();
            case 'log':
                return await fetchLogData();
            case 'output':
                return await fetchOutputData();
            default:
                return null;
        }
    } catch (e) {
        return { __error: e.message };
    }
}

/**
 * Render tab content (tree view or error)
 */
function renderTabContent(data) {
    const contentElement = modalElement?.querySelector('.modal-content');
    if (!contentElement) return;

    if (data === null) {
        contentElement.innerHTML = '<div class="modal-error">No data found for this task</div>';
    } else if (data?.__error) {
        contentElement.innerHTML = `<div class="modal-error">${escapeHtml(data.__error)}</div>`;
    } else {
        contentElement.innerHTML = '';
        const treeContainer = createJsonTree(data);
        contentElement.appendChild(treeContainer);
        attachTreeEventListeners(treeContainer);
    }
}

/**
 * Fetch kanban-progress.json and extract task entry
 */
async function fetchProgressData() {
    if (!progressDataCache) {
        const response = await fetch(`../kanban-progress.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to load kanban-progress.json');
        progressDataCache = await response.json();
    }

    // Find task in progress data
    const taskEntry = progressDataCache.tasks?.find(t => t.name === currentTaskName);
    return taskEntry || null;
}

/**
 * Fetch kanban-board.json and extract task entry
 */
async function fetchBoardData() {
    if (!boardDataCache) {
        const response = await fetch(`../kanban-board.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to load kanban-board.json');
        boardDataCache = await response.json();
    }

    // Find task in board data
    const taskEntry = boardDataCache.tasks?.find(t => t.name === currentTaskName);
    return taskEntry || null;
}

/**
 * Fetch logs/{taskName}.json
 */
async function fetchLogData() {
    if (!currentTaskName) return null;

    if (!logDataCache.has(currentTaskName)) {
        try {
            const response = await fetch(`../logs/${currentTaskName}.json?t=${Date.now()}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Log file not found: logs/${currentTaskName}.json`);
                }
                throw new Error(`Failed to load log file (${response.status})`);
            }
            logDataCache.set(currentTaskName, await response.json());
        } catch (e) {
            if (e.message.includes('not found') || e.message.includes('404')) {
                throw e;
            }
            throw new Error(`Log file not found: logs/${currentTaskName}.json`);
        }
    }

    return logDataCache.get(currentTaskName);
}

/**
 * Fetch logs/{taskName}-output.json
 */
async function fetchOutputData() {
    if (!currentTaskName) return null;

    const cacheKey = `${currentTaskName}-output`;
    if (!outputDataCache.has(cacheKey)) {
        try {
            const response = await fetch(`../logs/${currentTaskName}-output.json?t=${Date.now()}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Output file not found: logs/${currentTaskName}-output.json`);
                }
                throw new Error(`Failed to load output file (${response.status})`);
            }
            outputDataCache.set(cacheKey, await response.json());
        } catch (e) {
            if (e.message.includes('not found') || e.message.includes('404')) {
                throw e;
            }
            throw new Error(`Output file not found: logs/${currentTaskName}-output.json`);
        }
    }

    return outputDataCache.get(cacheKey);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== JSON Tree Rendering =====

/**
 * Creates a collapsible JSON tree from data
 */
function createJsonTree(data) {
    const container = document.createElement('div');
    container.className = 'json-tree';
    const rootNode = buildNode(data, null, 'root', 0, true);
    container.appendChild(rootNode);
    return container;
}

/**
 * Recursively builds DOM nodes for JSON values
 */
function buildNode(value, key, path, depth, isLast) {
    if (value === null) {
        return createPrimitiveNode(value, key, path, depth, isLast, 'null');
    }
    if (Array.isArray(value)) {
        return createArrayNode(value, key, path, depth, isLast);
    }
    if (typeof value === 'object') {
        return createObjectNode(value, key, path, depth, isLast);
    }
    return createPrimitiveNode(value, key, path, depth, isLast, typeof value);
}

/**
 * Creates a node for primitive values (string, number, boolean, null)
 */
function createPrimitiveNode(value, key, path, depth, isLast, type) {
    const node = document.createElement('div');
    node.className = 'json-node json-primitive';
    node.dataset.path = path;

    let html = '';

    if (key !== null) {
        const keyStr = escapeHtml(JSON.stringify(key));
        html += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
        html += '<span class="json-colon">: </span>';
    }

    let valueStr;
    let valueClass;
    let searchableValue;

    if (type === 'null') {
        valueStr = 'null';
        valueClass = 'json-null';
        searchableValue = 'null';
    } else if (type === 'string') {
        valueStr = escapeHtml(JSON.stringify(value));
        valueClass = 'json-string';
        searchableValue = escapeHtml(value);
    } else if (type === 'number') {
        valueStr = String(value);
        valueClass = 'json-number';
        searchableValue = String(value);
    } else if (type === 'boolean') {
        valueStr = String(value);
        valueClass = 'json-boolean';
        searchableValue = String(value);
    }

    html += `<span class="${valueClass}" data-searchable="${searchableValue}">${valueStr}</span>`;

    if (!isLast) {
        html += '<span class="json-comma">,</span>';
    }

    node.innerHTML = html;
    return node;
}

/**
 * Creates a collapsible node for objects
 */
function createObjectNode(obj, key, path, depth, isLast) {
    const node = document.createElement('div');
    node.className = 'json-node json-object';
    node.dataset.path = path;

    const entries = Object.entries(obj);
    const count = entries.length;

    let headerHtml = '<span class="json-toggle">▼</span>';

    if (key !== null) {
        const keyStr = escapeHtml(JSON.stringify(key));
        headerHtml += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
        headerHtml += '<span class="json-colon">: </span>';
    }

    headerHtml += '<span class="json-brace">{</span>';
    headerHtml += `<span class="json-summary">${count} ${count === 1 ? 'item' : 'items'}</span>`;

    node.innerHTML = headerHtml;

    // Create children container
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'json-children';

    entries.forEach(([childKey, childValue], index) => {
        const childPath = `${path}.${childKey}`;
        const childIsLast = index === entries.length - 1;
        const childNode = buildNode(childValue, childKey, childPath, depth + 1, childIsLast);
        childrenContainer.appendChild(childNode);
    });

    node.appendChild(childrenContainer);

    // Closing brace
    const closeBrace = document.createElement('span');
    closeBrace.className = 'json-brace json-close';
    closeBrace.textContent = '}';
    node.appendChild(closeBrace);

    if (!isLast) {
        const comma = document.createElement('span');
        comma.className = 'json-comma';
        comma.textContent = ',';
        node.appendChild(comma);
    }

    return node;
}

/**
 * Creates a collapsible node for arrays
 */
function createArrayNode(arr, key, path, depth, isLast) {
    const node = document.createElement('div');
    node.className = 'json-node json-array';
    node.dataset.path = path;

    const count = arr.length;

    let headerHtml = '<span class="json-toggle">▼</span>';

    if (key !== null) {
        const keyStr = escapeHtml(JSON.stringify(key));
        headerHtml += `<span class="json-key" data-searchable="${escapeHtml(key)}">${keyStr}</span>`;
        headerHtml += '<span class="json-colon">: </span>';
    }

    headerHtml += '<span class="json-bracket">[</span>';
    headerHtml += `<span class="json-summary">${count} ${count === 1 ? 'item' : 'items'}</span>`;

    node.innerHTML = headerHtml;

    // Create children container
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'json-children';

    arr.forEach((childValue, index) => {
        const childPath = `${path}[${index}]`;
        const childIsLast = index === arr.length - 1;
        const childNode = buildNode(childValue, index, childPath, depth + 1, childIsLast);
        childrenContainer.appendChild(childNode);
    });

    node.appendChild(childrenContainer);

    // Closing bracket
    const closeBracket = document.createElement('span');
    closeBracket.className = 'json-bracket json-close';
    closeBracket.textContent = ']';
    node.appendChild(closeBracket);

    if (!isLast) {
        const comma = document.createElement('span');
        comma.className = 'json-comma';
        comma.textContent = ',';
        node.appendChild(comma);
    }

    return node;
}

/**
 * Toggle collapsed state of a node
 */
function toggleNode(node) {
    node.classList.toggle('collapsed');
}

/**
 * Set collapsed state of a node
 */
function setNodeCollapsed(node, collapsed) {
    if (collapsed) {
        node.classList.add('collapsed');
    } else {
        node.classList.remove('collapsed');
    }
}

/**
 * Attach event listeners for tree interactions
 */
function attachTreeEventListeners(container) {
    // Click on toggle icon
    container.addEventListener('click', (e) => {
        const toggle = e.target.closest('.json-toggle');
        if (toggle) {
            const node = toggle.closest('.json-node');
            if (node) {
                toggleNode(node);
            }
        }
    });

    // Double-click on key to toggle
    container.addEventListener('dblclick', (e) => {
        const key = e.target.closest('.json-key');
        if (key) {
            const node = key.closest('.json-node');
            if (node && (node.classList.contains('json-object') || node.classList.contains('json-array'))) {
                toggleNode(node);
            }
        }
    });
}

// ===== Search Functionality =====

/**
 * Initialize search input listeners
 */
function initSearch() {
    const searchInput = document.getElementById('metadata-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        // Debounce search
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            const query = e.target.value.trim();
            const container = document.querySelector('.json-tree');
            if (container) {
                const matches = searchJson(container, query);
                updateSearchCount(matches.length);
            } else {
                updateSearchCount(null);
            }
        }, 300);
    });
}

/**
 * Search and highlight matches in the JSON tree
 */
function searchJson(container, query) {
    // Clear previous highlights
    clearSearchHighlights(container);

    if (!query) {
        return [];
    }

    const matches = [];
    const searchLower = query.toLowerCase();

    // Find all searchable elements
    const searchables = container.querySelectorAll('[data-searchable]');

    searchables.forEach(el => {
        const text = el.dataset.searchable.toLowerCase();
        if (text.includes(searchLower)) {
            // Highlight the match
            const originalHtml = el.innerHTML;
            const originalText = el.textContent;

            // Find match positions and wrap them
            const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
            const newHtml = originalText.replace(regex, '<span class="json-match">$1</span>');
            el.innerHTML = newHtml;

            matches.push(el);
        }
    });

    // Expand ancestors of all matches
    expandSearchMatches(container, matches);

    return matches;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clear all search highlights
 */
function clearSearchHighlights(container) {
    const highlights = container.querySelectorAll('.json-match');
    highlights.forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            parent.innerHTML = parent.textContent;
        }
    });
}

/**
 * Expand collapsed ancestors for all matches
 */
function expandSearchMatches(container, matches) {
    matches.forEach(match => {
        let parent = match.closest('.json-node');
        while (parent) {
            // Expand if it's a collapsible node
            if (parent.classList.contains('json-object') || parent.classList.contains('json-array')) {
                setNodeCollapsed(parent, false);
            }
            parent = parent.parentElement?.closest('.json-node');
        }
    });
}

/**
 * Update the search match count display
 */
function updateSearchCount(count) {
    const countEl = document.getElementById('metadata-search-count');
    if (!countEl) return;

    if (count === null || count === undefined) {
        countEl.textContent = '';
    } else if (count === 0) {
        countEl.textContent = 'No matches';
    } else {
        countEl.textContent = `${count} ${count === 1 ? 'match' : 'matches'}`;
    }
}

// ===== Auto-Refresh Polling =====

/**
 * Start auto-refresh polling (every 1 second)
 */
function startRefreshPolling() {
    stopRefreshPolling();

    refreshInterval = setInterval(async () => {
        await refreshCurrentTab();
    }, 1000);
}

/**
 * Stop auto-refresh polling
 */
function stopRefreshPolling() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

/**
 * Refresh the current tab's content if data changed
 */
async function refreshCurrentTab() {
    if (!currentTabName || !modalElement) return;

    // Clear cache before fetching to get fresh data
    clearCache();

    // Re-check tab availability (data might have appeared)
    checkTabDataAvailability();

    const newData = await fetchTabData(currentTabName);

    // Only re-render if data changed
    const newDataStr = JSON.stringify(newData);
    const oldDataStr = JSON.stringify(currentTabData);

    if (newDataStr !== oldDataStr) {
        currentTabData = newData;
        renderTabContent(newData);

        // Preserve search query if any
        const searchInput = document.getElementById('metadata-search');
        if (searchInput && searchInput.value.trim()) {
            const container = document.querySelector('.json-tree');
            if (container) {
                const matches = searchJson(container, searchInput.value.trim());
                updateSearchCount(matches.length);
            }
        }
    }
}

/**
 * Start dragging the modal
 */
function startDrag(e) {
    // Don't drag if clicking close button
    if (e.target.closest('.modal-close')) return;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = modalElement.getBoundingClientRect();
    modalStartX = rect.left;
    modalStartY = rect.top;

    e.preventDefault();
}

/**
 * Start resizing the modal
 */
function startResize(e) {
    isResizing = true;

    // Get resize direction from handle class
    const handle = e.target;
    const classes = handle.className.split(' ');
    resizeDirection = classes.find(c => c.startsWith('resize-') && c !== 'resize-handle')?.replace('resize-', '') || '';

    resizeStartX = e.clientX;
    resizeStartY = e.clientY;

    const rect = modalElement.getBoundingClientRect();
    modalStartWidth = rect.width;
    modalStartHeight = rect.height;
    modalStartLeft = rect.left;
    modalStartTop = rect.top;

    e.preventDefault();
}

/**
 * Clamp modal position to keep at least 50px of header visible within viewport
 */
function clampPosition(left, top, width, height) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minVisible = 50; // At least 50px of header must remain visible

    // Clamp horizontal: ensure minVisible pixels of modal are visible on each side
    const minLeft = minVisible - width;
    const maxLeft = viewportWidth - minVisible;
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, left));

    // Clamp vertical: keep header visible (top can't go above viewport, bottom limited)
    const minTop = 0;
    const maxTop = viewportHeight - minVisible;
    const clampedTop = Math.max(minTop, Math.min(maxTop, top));

    return { left: clampedLeft, top: clampedTop };
}

/**
 * Handle mouse move for drag/resize
 */
function handleMouseMove(e) {
    if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        const newLeft = modalStartX + deltaX;
        const newTop = modalStartY + deltaY;
        const width = modalElement.offsetWidth;
        const height = modalElement.offsetHeight;

        const clamped = clampPosition(newLeft, newTop, width, height);
        modalElement.style.left = `${clamped.left}px`;
        modalElement.style.top = `${clamped.top}px`;
    }

    if (isResizing) {
        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;

        let newWidth = modalStartWidth;
        let newHeight = modalStartHeight;
        let newLeft = modalStartLeft;
        let newTop = modalStartTop;

        // Handle horizontal resizing
        if (resizeDirection.includes('e')) {
            newWidth = Math.max(MIN_WIDTH, modalStartWidth + deltaX);
        }
        if (resizeDirection.includes('w')) {
            const widthDelta = Math.min(deltaX, modalStartWidth - MIN_WIDTH);
            newWidth = modalStartWidth - widthDelta;
            newLeft = modalStartLeft + widthDelta;
        }

        // Handle vertical resizing
        if (resizeDirection.includes('s')) {
            newHeight = Math.max(MIN_HEIGHT, modalStartHeight + deltaY);
        }
        if (resizeDirection.includes('n')) {
            const heightDelta = Math.min(deltaY, modalStartHeight - MIN_HEIGHT);
            newHeight = modalStartHeight - heightDelta;
            newTop = modalStartTop + heightDelta;
        }

        // Apply viewport constraints to resized position
        const clamped = clampPosition(newLeft, newTop, newWidth, newHeight);

        modalElement.style.width = `${newWidth}px`;
        modalElement.style.height = `${newHeight}px`;
        modalElement.style.left = `${clamped.left}px`;
        modalElement.style.top = `${clamped.top}px`;
    }
}

/**
 * Handle mouse up to end drag/resize
 */
function handleMouseUp() {
    if (isResizing) {
        saveModalSize();
    }
    isDragging = false;
    isResizing = false;
}
