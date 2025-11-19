/**
 * storage.js
 * Squelette pour la persistance localStorage. Codex : copier la logique depuis `app.js`.
 */
import { state, normalizeInputs, defaultBookkeepingState, normalizeBookkeeping } from './state.js';
import { STORAGE_KEY } from './config/constants.js';

export const storage = {
  save(options = {}) {
    const { force = false } = options;
    if (!state.autoSaveEnabled && !force) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          inputs: state.inputs,
          bookkeeping: state.bookkeeping,
          autoSaveEnabled: state.autoSaveEnabled
        })
      );
    } catch (error) {
      console.error(error);
      // Note: avoid importer ui pour prévenir les dépendances circulaires
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      // apply migration/normalization
      if (data && data.inputs) {
        const normalized = normalizeInputs(data.inputs);
        state.inputs = normalized;
      }
      if (data && data.bookkeeping) {
        state.bookkeeping = normalizeBookkeeping(data.bookkeeping);
      } else {
        state.bookkeeping = defaultBookkeepingState();
      }
      if (typeof data.autoSaveEnabled === 'boolean') {
        state.autoSaveEnabled = data.autoSaveEnabled;
      }
      // UI toast intentionally omitted to avoid circular imports
    } catch (error) {
      console.error(error);
    }
  },

  export() {
    const blob = new Blob(
      [
        JSON.stringify(
          { timestamp: new Date().toISOString(), inputs: state.inputs, bookkeeping: state.bookkeeping },
          null,
          2
        )
      ],
      {
        type: 'application/json'
      }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'business-plan-eurl.json';
    anchor.click();
    URL.revokeObjectURL(url);
    // UI toast intentionally omitted to avoid circular imports
  }
};

export default storage;
