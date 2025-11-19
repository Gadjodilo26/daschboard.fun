/**
 * main.js
 * Point d'entrée ultra-léger : délègue toute la logique à appController.
 */
import { initApp } from './controllers/appController.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export default { initApp };
