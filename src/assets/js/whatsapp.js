document.addEventListener('DOMContentLoaded', () => {
  const dock = document.querySelector('.whatsapp-dock');
  if (!dock) return;

  const number = dock.dataset.whatsapp || '';
  const toggle = dock.querySelector('[data-wa-toggle]');
  const panel = dock.querySelector('.whatsapp-panel');
  const form = dock.querySelector('#whatsappQuickForm');
  const status = document.createElement('p');
  status.className = 'whatsapp-status';
  status.setAttribute('aria-live', 'polite');
  panel?.appendChild(status);

  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const isHidden = panel.hasAttribute('hidden');
      if (isHidden) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
      toggle.setAttribute('aria-expanded', String(isHidden));
    });
  }

  if (form && number) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const noteField = form.querySelector('textarea[name="waNote"]');
      const topicField = form.querySelector('select[name="waTopic"]');
      if (!noteField) return;
      const note = noteField.value.trim();
      if (!note) {
        status.textContent = 'Ajoute une note avant d’envoyer.';
        return;
      }
      const topic = topicField?.value || 'Note';
      const message = encodeURIComponent(`[${topic}] ${note}`);
      window.open(`https://wa.me/${number}?text=${message}`, '_blank');
      status.textContent = 'Note envoyée sur WhatsApp.';
      form.reset();
    });
  }
});
