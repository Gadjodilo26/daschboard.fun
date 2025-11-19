/**
 * main.js
 * Point d'entrée ultra-léger : délègue toute la logique à appController.
 */
import { initApp } from './controllers/appController.js';
import { initStatusQuiz } from './ui.js';

const bootstrap = () => {
  initApp();
  initStatusQuiz();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

export default { initApp };