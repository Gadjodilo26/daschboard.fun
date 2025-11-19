/**
 * controllers/appController.js
 * Point d'entrée logique : initialise l'application et orchestre les re-rendus globaux.
 */
import { state } from '../state.js';
import { storage } from '../storage.js';
import { ui } from '../ui.js';
import { recalculate } from '../core/engine.js';
import { registerEventListeners } from './events.js';

export function initApp() {
  state.currentPage = document.body.dataset.page || 'landing';
  storage.load();
  recalculate();
  registerEventListeners();
  ui.renderAll();
}

export default { initApp };
