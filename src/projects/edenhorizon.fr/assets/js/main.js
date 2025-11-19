// --- Simulateur --- //
function formatEuro(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function compute() {
  const loyerClassique = Number((document.getElementById('loyer').value || 900));
  const loyerGaranti   = Number((document.getElementById('garanti').value || (loyerClassique * 1.15)));
  const bonus          = Number((document.getElementById('bonus').value || 150));
  const entretien      = Number((document.getElementById('entretien').value || 0));
  const charges        = Number((document.getElementById('charges').value || 0));

  const netClassique = loyerClassique - charges - entretien;
  const netEden      = loyerGaranti + bonus - charges - entretien;

  const outA = document.getElementById('out-classique');
  const outB = document.getElementById('out-eden');
  const outD = document.getElementById('diff');

  if (outA) outA.textContent = formatEuro(netClassique);
  if (outB) outB.textContent = formatEuro(netEden);

  const diff = netEden - netClassique;
  const pct  = ((diff / Math.max(1, netClassique)) * 100).toFixed(0);
  if (outD) outD.textContent = `${formatEuro(diff)} / +${pct}%`;
}

// Init au chargement
document.addEventListener('DOMContentLoaded', () => {
  compute();
  // Annuler le submit réel pour la démo et afficher un message UX
  const form = document.querySelector('#devis form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Merci ! Nous vous recontactons sous 24h ouvrées.');
    });
  }
  // Année de pied de page
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
// --- Simulateur --- //
function formatEuro(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function compute() {
  const loyerClassique = Number((document.getElementById('loyer').value || 900));
  const loyerGaranti   = Number((document.getElementById('garanti').value || (loyerClassique * 1.15)));
  const bonus          = Number((document.getElementById('bonus').value || 150));
  const entretien      = Number((document.getElementById('entretien').value || 0));
  const charges        = Number((document.getElementById('charges').value || 0));

  const netClassique = loyerClassique - charges - entretien;
  const netEden      = loyerGaranti + bonus - charges - entretien;

  const outA = document.getElementById('out-classique');
  const outB = document.getElementById('out-eden');
  const outD = document.getElementById('diff');

  if (outA) outA.textContent = formatEuro(netClassique);
  if (outB) outB.textContent = formatEuro(netEden);

  const diff = netEden - netClassique;
  const pct  = ((diff / Math.max(1, netClassique)) * 100).toFixed(0);
  if (outD) outD.textContent = `${formatEuro(diff)} / +${pct}%`;
}

// Init au chargement

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#devis form');  // ou #contactForm
   const fallback = document.getElementById('mail-fallback');
  const copyBtn = document.getElementById('copy-btn');
  const fallbackEmail = document.getElementById('fallback-email');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const to = form.getAttribute('data-to') || 'contact@eden-horizon.fr';

    // Récup champs
    const name      = (document.getElementById('name')?.value || '').trim();
    const email     = (document.getElementById('email')?.value || '').trim();
    const phone     = (document.getElementById('phone')?.value || '').trim();
    const city      = (document.getElementById('city')?.value || '').trim();
    const typeBien  = (document.getElementById('type')?.value || '').trim();
    const message   = (document.getElementById('msg')?.value || '').trim();

    // Sujet & corps (avec retours à la ligne encodés)
    const subject = `Demande d’estimation – ${city || 'Ville ?'} – ${typeBien || 'Type ?'}`;

    const bodyLines = [
      `Bonjour Eden Horizon,`,
      ``,
      `Je souhaite une estimation personnalisée pour mon bien.`,
      ``,
      `Nom : ${name || '—'}`,
      `Email : ${email || '—'}`,
      `Téléphone : ${phone || '—'}`,
      `Ville : ${city || '—'}`,
      `Type de bien : ${typeBien || '—'}`,
      ``,
      `Commentaires :`,
      `${message || '—'}`,
      ``,
      `— Envoyé depuis le formulaire du site —`
    ];

    const mailto = `mailto:${encodeURIComponent(to)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(bodyLines.join('\n'))}`;

    // Ouvre le client mail par défaut (mobile/desktop)
    window.location.href = mailto;
    // Fallback affiché pour aider si rien ne se passe
    setTimeout(() => {
      if (fallback) fallback.style.display = 'block';
    }, 1500);
  });

  // Bouton copier
  if (copyBtn && fallbackEmail) {
    copyBtn.addEventListener('click', () => {
      fallbackEmail.select();
      document.execCommand('copy');
      copyBtn.textContent = 'Copié !';
      setTimeout(() => { copyBtn.textContent = 'Copier'; }, 2000);
    });
  }

  // Année de pied de page
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

// --- NAV MOBILE --- //
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');

  if (toggle && nav) {
    const closeNav = () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    const openNav = () => {
      nav.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.contains('open');
      isOpen ? closeNav() : openNav();
    });

    // Fermer le menu quand on clique sur un lien
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => closeNav());
    });

    // Réinitialiser si on repasse en desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
});


