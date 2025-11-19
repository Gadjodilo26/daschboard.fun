/**
 * storage.js
 * Squelette pour la persistance localStorage. Codex : copier la logique depuis `app.js`.
 */
import { state, normalizeInputs, defaultBookkeepingState, normalizeBookkeeping } from './state.js';
import { STORAGE_KEY, LEGACY_STORAGE_KEYS } from './config/constants.js';

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
      let raw = localStorage.getItem(STORAGE_KEY);
      let sourceKey = STORAGE_KEY;
      if (!raw) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacyValue = localStorage.getItem(legacyKey);
          if (legacyValue) {
            raw = legacyValue;
            sourceKey = legacyKey;
            break;
          }
        }
      }
      if (!raw) return;
      const data = JSON.parse(raw);
      if (sourceKey !== STORAGE_KEY) {
        try {
          localStorage.setItem(STORAGE_KEY, raw);
          localStorage.removeItem(sourceKey);
        } catch (persistError) {
          console.warn('Migration stockage non terminée', persistError);
        }
      }
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
    anchor.download = 'atelier-entreprendre.json';
    anchor.click();
    URL.revokeObjectURL(url);
    // UI toast intentionally omitted to avoid circular imports
  }
};

export default storage;
