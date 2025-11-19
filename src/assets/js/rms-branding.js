(() => {
  const init = () => {
    const body = document.body;
    if (!body || body.dataset.rmsBranding === 'native') return;
    if (body.querySelector('.rms-brand-badge')) return;

    const currentScript =
      document.currentScript ||
      document.querySelector('script[data-rms-branding]');
    const resolveFromScript = (relativePath) => {
      if (!currentScript || !currentScript.src) {
        return relativePath;
      }
      return new URL(relativePath, currentScript.src).href;
    };

    const logoUrl = resolveFromScript('../img/logo/logoOfficielRMS.svg');
    const homeUrl = resolveFromScript('../../../index.html');

    const style = document.createElement('style');
    style.setAttribute('data-rms-branding', 'true');
    style.textContent = `
      .rms-brand-badge {
        position: fixed;
        inset: auto 1.5rem 1.5rem auto;
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.6rem 1rem;
        color: #f7f8ff;
        background: rgba(5, 6, 15, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        text-decoration: none;
        font-family: 'Space Grotesk', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 0.85rem;
        line-height: 1.2;
        box-shadow: 0 18px 35px rgba(5, 6, 15, 0.45);
        backdrop-filter: blur(8px);
        z-index: 3000;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .rms-brand-badge:hover,
      .rms-brand-badge:focus-visible {
        transform: translateY(-2px);
        box-shadow: 0 25px 40px rgba(5, 6, 15, 0.55);
      }

      .rms-brand-badge img {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        padding: 6px;
        background: rgba(255, 255, 255, 0.08);
      }

      .rms-brand-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.78rem;
        color: rgba(247, 248, 255, 0.85);
      }

      .rms-brand-text strong {
        font-size: 0.85rem;
        letter-spacing: 0.02em;
        color: #f7f8ff;
      }

      .rms-brand-text em {
        font-style: normal;
        font-size: 0.72rem;
        color: rgba(247, 248, 255, 0.7);
      }

      @media (max-width: 640px) {
        .rms-brand-badge {
          inset: auto 1rem 1rem auto;
          border-radius: 18px;
          padding: 0.4rem 0.75rem;
        }

        .rms-brand-text {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);

    const badge = document.createElement('a');
    badge.className = 'rms-brand-badge';
    badge.href = homeUrl;
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';
    badge.innerHTML = `
      <img src="${logoUrl}" alt="Logo RMS Launchpad">
      <span class="rms-brand-text">
        <strong>RMS Launchpad</strong>
        <em>Créateur de ce projet</em>
      </span>
    `;

    body.appendChild(badge);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
