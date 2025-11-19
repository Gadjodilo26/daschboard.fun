// Gestion du modal de contact + soumission
const contactState = {
  email: '',
  formspree: '',
  whatsapp: ''
};

const contactSelectors = {
  modal: '#contactModal',
  form: '#contactForm',
  status: '#contactStatus'
};

function setContactData(detail) {
  contactState.email = detail?.site?.contact?.email || '';
  contactState.formspree = detail?.site?.contact?.formspree || '';
  contactState.whatsapp = detail?.site?.contact?.whatsapp || '';
}

document.addEventListener('rms:data-ready', (event) => setContactData(event.detail));

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.querySelector(contactSelectors.modal);
  const form = document.querySelector(contactSelectors.form);
  const status = document.querySelector(contactSelectors.status);

  if (!modal || !form) return;

  const openButtons = document.querySelectorAll('[data-open="contactModal"]');
  openButtons.forEach(btn => btn.addEventListener('click', () => openModal(modal)));

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close]')) {
      closeModal(modal, status);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal(modal, status);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    submitContact(payload, status, form);
  });
});

function openModal(modal) {
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  const firstInput = modal.querySelector('input, textarea, select');
  firstInput?.focus();
}

function closeModal(modal, status) {
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  if (status) {
    status.textContent = '';
  }
}

async function submitContact(payload, statusNode, form) {
  if (!statusNode) return;
  statusNode.textContent = 'Préparation de la note...';

  try {
    if (contactState.whatsapp && payload.note) {
      const topic = payload.topic || 'Note';
      const action = payload.action ? `\nAction à planifier : ${payload.action}` : '';
      const message = encodeURIComponent(`Sujet : ${topic}\nNote : ${payload.note}${action}`);
      window.open(`https://wa.me/${contactState.whatsapp}?text=${message}`, '_blank');
      statusNode.textContent = 'Note envoyée sur WhatsApp.';
    } else if (contactState.formspree) {
      await fetch(contactState.formspree, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      statusNode.textContent = 'Message enregistré.';
    } else if (contactState.email) {
      const subject = encodeURIComponent('Note rapide RMS Launchpad');
      const body = encodeURIComponent(`Sujet: ${payload.topic || 'Note'}\nNote: ${payload.note || '—'}\nAction: ${payload.action || '—'}`);
      window.location.href = `mailto:${contactState.email}?subject=${subject}&body=${body}`;
      statusNode.textContent = 'Votre messagerie va s’ouvrir pour finaliser l’envoi.';
    } else {
      statusNode.textContent = 'Canal d’envoi non configuré.';
    }
    form.reset();
  } catch (error) {
    console.error(error);
    statusNode.textContent = 'Impossible d’envoyer la note pour le moment.';
  }
}
