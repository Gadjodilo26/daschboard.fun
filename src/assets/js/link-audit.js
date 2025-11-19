// Audit simple des liens internes (OK / cassés / bientôt)
async function auditLinks() {
  const reportNode = document.getElementById('linkReport');
  if (!reportNode) return;

  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const soonLinks = anchors.filter(a => a.getAttribute('aria-disabled') === 'true').map(a => a.textContent.trim());

  const internalLinks = Array.from(new Set(
    anchors
      .filter(a => a.href.startsWith(window.location.origin) && !a.hash)
      .map(a => a.href)
  ));

  const result = { ok: [], broken: [], soon: soonLinks };

  await Promise.all(internalLinks.map(async href => {
    try {
      const response = await fetch(href, { method: 'HEAD' });
      if (response.ok) {
        result.ok.push(href);
      } else {
        result.broken.push(href);
      }
    } catch (error) {
      result.broken.push(href);
    }
  }));

  const summary = `Liens internes OK: ${result.ok.length} • Cassés: ${result.broken.length} • Bientôt: ${result.soon.length}`;
  reportNode.textContent = summary;
  console.info('RMS Launchpad — rapport de liens', result);
}

if (document.readyState === 'complete') {
  setTimeout(auditLinks, 600);
} else {
  window.addEventListener('load', () => setTimeout(auditLinks, 600));
}

document.addEventListener('rms:data-ready', () => setTimeout(auditLinks, 600));
