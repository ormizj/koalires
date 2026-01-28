/**
 * Store barrel export and initialization
 */
import { boardStore } from './board-store.js';
import { modalStore } from './modal-store.js';
import { uiStore } from './ui-store.js';
import { tableStore } from './table-store.js';

export { boardStore } from './board-store.js';
export { modalStore } from './modal-store.js';
export { uiStore } from './ui-store.js';
export { tableStore } from './table-store.js';

/**
 * Initialize all stores (load persisted state)
 */
export function initStores() {
  boardStore.loadColumnState();
  modalStore.loadState();
  uiStore.loadState();
  tableStore.loadState();
}
