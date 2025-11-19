const DATA_SOURCES = {
  site: 'src/data/site.json',
  projects: 'src/data/projects.json',
  links: 'src/data/links.json',
  timeline: 'src/data/timeline.json',
  kpis: 'src/data/kpis.json'
};

const PRIVATE_PATTERNS = [/XXXXXXXX/, /manager\.infomaniak\.com/, /kdrive\.infomaniak\.com/];

const state = {
  site: null,
  projects: [],
  links: [],
  docks: [],
  timeline: [],
  kpis: []
};

document.addEventListener('DOMContentLoaded', initApp);

// --- Initialisation principale ---
async function initApp() {
  try {
    const [site, projects, links, timeline, kpis] = await Promise.all([
      fetchJSON(DATA_SOURCES.site),
      fetchJSON(DATA_SOURCES.projects),
      fetchJSON(DATA_SOURCES.links),
      fetchJSON(DATA_SOURCES.timeline),
      fetchJSON(DATA_SOURCES.kpis)
    ]);

    state.site = site;
    state.projects = projects;
    state.links = links.groups || [];
    state.docks = links.docks || [];
    state.timeline = timeline;
    state.kpis = kpis;

    renderCTA(site.contact);
    renderProjects(projects);
    renderResources(state.links);
    renderDocks(state.docks.length ? state.docks : state.links);
    renderLab(site.insights || []);
    renderKpis(kpis);
    renderWorkflows(site.workflows || []);
    renderTimeline(timeline);
    renderServices(site.services || [], site.method || []);
    renderFaq(site.faq || []);

    setupToolsMenu();
    setupMobileNav();
    setupShareButtons();
    setupObserver();
    applyTikTokParams(site.proofs || []);
    setupAdCarousel();

    document.dispatchEvent(new CustomEvent('rms:data-ready', { detail: { site } }));
  } catch (error) {
    console.error('Erreur lors du chargement des données', error);
  }
}

// --- Utilitaires data ---
async function fetchJSON(path) {
  const response = await fetch(path, { headers: { 'Cache-Control': 'no-store' } });
  if (!response.ok) {
    throw new Error(`Impossible de charger ${path}`);
  }
  return response.json();
}

// --- Rendu hero / CTA ---
function renderCTA(contact) {
  const stickyCta = document.getElementById('stickyCta');
  const ctaLabel = stickyCta?.querySelector('[data-cta-label]');
  if (ctaLabel && contact?.ctaLabel) {
    ctaLabel.textContent = contact.ctaLabel;
  }
}

// --- Projets ---
function renderProjects(projects) {
  const grid = document.getElementById('projectGrid');
  if (!grid) return;

  const render = filter => {
    grid.innerHTML = '';
    projects
      .filter(project => filter === 'all' ? true : project.type === filter)
      .forEach(project => {
        const card = document.createElement('article');
        card.className = 'project-card';

        const statusBadge = document.createElement('span');
        statusBadge.className = `badge status-${project.status}`;
        statusBadge.textContent = project.status === 'active' ? 'Actif' : project.status === 'wip' ? 'En cours' : 'Bientôt';

        const title = document.createElement('h3');
        title.textContent = project.title;

        const summary = document.createElement('p');
        summary.textContent = project.summary;

        let nextNode = null;
        if (project.next) {
          nextNode = document.createElement('p');
          nextNode.className = 'project-next';
          nextNode.textContent = `Focus : ${project.next}`;
          card.dataset.next = nextNode.textContent;
        }

        const meta = document.createElement('p');
        meta.className = 'project-meta';
        meta.textContent = `${project.role} • ${project.year}`;

        const stack = document.createElement('p');
        stack.className = 'project-stack';
        stack.textContent = project.stack.join(' • ');

        const actions = document.createElement('div');
        actions.className = 'project-actions';

        const link = document.createElement('a');
        link.href = project.link === '#' ? 'javascript:void(0)' : project.link;
        link.className = 'btn tertiary';
        link.textContent = project.status === 'soon' ? 'À ouvrir bientôt' : 'Ouvrir le projet';
        if (project.status === 'soon') {
          link.setAttribute('aria-disabled', 'true');
          link.style.pointerEvents = 'none';
        } else {
          link.target = '_blank';
          link.rel = 'noopener';
        }
        actions.appendChild(link);

        if (project.download) {
          const downloadBtn = document.createElement('a');
          downloadBtn.href = project.download;
          downloadBtn.className = 'btn secondary';
          downloadBtn.textContent = 'Télécharger (ZIP)';
          downloadBtn.setAttribute('download', '');
          actions.appendChild(downloadBtn);
        }

        card.append(statusBadge, title, summary);
        if (nextNode) {
          card.appendChild(nextNode);
        }
        card.append(meta, stack, actions);
        grid.appendChild(card);
      });
  };

  const filterButtons = document.querySelectorAll('.project-filters button');
  filterButtons.forEach(btn => btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render(btn.dataset.filter);
  }));

  render('all');
}

// --- Ressources (liste) ---
function renderResources(groups) {
  const container = document.getElementById('resourceGrid');
  if (!container) return;
  container.innerHTML = '';

  groups.forEach(group => {
    const card = document.createElement('article');
    card.className = `resource-card accent-${group.accent || 'rms'}`;

    card.innerHTML = `
      <header>
        <h3>${group.title}</h3>
        <p>${group.description}</p>
      </header>
    `;

    const list = document.createElement('ul');

    group.items.forEach(item => {
      const li = document.createElement('li');
      const isSoon = shouldDisable(item.url);
      const link = document.createElement('a');
      link.textContent = item.label;
      link.href = isSoon ? 'javascript:void(0)' : item.url;
      if (isSoon) {
        link.setAttribute('aria-disabled', 'true');
        link.classList.add('is-disabled');
        const badge = document.createElement('span');
        badge.className = 'badge status-soon';
        badge.textContent = 'Bientôt';
        li.append(link, badge);
      } else {
        link.target = '_blank';
        link.rel = 'noopener';
        li.appendChild(link);
      }
      list.appendChild(li);
    });

    if (group.slots) {
      for (let i = 0; i < group.slots; i += 1) {
        const slot = document.createElement('li');
        slot.className = 'slot';
        slot.textContent = `Slot libre ${i + 1}`;
        list.appendChild(slot);
      }
    }

    card.appendChild(list);
    container.appendChild(card);
  });
}

// --- Ressources (docks) ---
function renderDocks(groups) {
  const container = document.getElementById('dockGrid');
  if (!container) return;
  container.innerHTML = '';

  groups.forEach(group => {
    const card = document.createElement('article');
    card.className = `dock-card accent-${group.accent || 'rms'}`;
    const header = document.createElement('header');
    header.innerHTML = `<h3>${group.title}</h3><p>${group.description}</p>`;
    card.appendChild(header);

    const dock = document.createElement('div');
    dock.className = 'dock';

    group.items.filter(item => item.type === 'app').forEach(item => {
      dock.appendChild(buildDockButton(item));
    });

    if (group.slots) {
      for (let i = 0; i < group.slots; i += 1) {
        const slot = document.createElement('div');
        slot.className = 'dock__slot';
        slot.textContent = `Slot libre ${i + 1}`;
        dock.appendChild(slot);
      }
    }

    card.appendChild(dock);
    container.appendChild(card);
  });
}

function buildDockButton(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dock__btn';

  const anchor = document.createElement('a');
  anchor.className = 'dock__link';
  const isSoon = shouldDisable(item.url);
  if (isSoon) {
    anchor.setAttribute('aria-disabled', 'true');
    anchor.style.pointerEvents = 'none';
  } else {
    anchor.href = item.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
  }

  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'dock__img';

  const primary = document.createElement('img');
  primary.className = 'dock__icon dock__icon--primary';
  primary.src = item.icon;
  primary.alt = item.label;
  primary.loading = 'lazy';
  withIcon(primary);

  const secondary = document.createElement('img');
  secondary.className = 'dock__icon dock__icon--secondary';
  secondary.src = item.icon;
  secondary.alt = `${item.label} (hover)`;
  secondary.loading = 'lazy';
  withIcon(secondary);

  imgWrapper.append(primary, secondary);
  anchor.appendChild(imgWrapper);
  wrapper.appendChild(anchor);

  const label = document.createElement('span');
  label.className = 'dock__label';
  label.textContent = item.label;
  wrapper.appendChild(label);

  if (isSoon) {
    const badge = document.createElement('span');
    badge.className = 'badge status-soon';
    badge.textContent = 'Bientôt';
    wrapper.appendChild(badge);
  }

  return wrapper;
}

// --- Fallback icône ---
function withIcon(img) {
  img.addEventListener('error', () => {
    img.src = '/src/assets/img/logo/atlas/_placeholder.svg';
    img.classList.add('icon-missing');
    img.alt += ' (icône indisponible)';
  });
}

// --- Veille / Lab ---
function renderLab(insights) {
  const container = document.getElementById('insightList');
  if (!container) return;

  const render = topic => {
    container.innerHTML = '';
    const filtered = topic === 'all' ? insights : insights.filter(item => item.topic === topic);
    filtered.forEach(item => {
      const article = document.createElement('article');
      article.className = 'insight-card';
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = item.title;
      article.appendChild(link);
      const chip = document.createElement('span');
      chip.className = 'chip subtle';
      chip.textContent = item.topic;
      article.appendChild(chip);
      container.appendChild(article);
    });
  };

  const buttons = document.querySelectorAll('.lab-controls .chip');
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render(btn.dataset.topic);
  }));

  render('all');
}

// --- KPIs internes ---
function renderKpis(kpis) {
  const grid = document.getElementById('kpiGrid');
  if (!grid) return;
  grid.innerHTML = '';

  kpis.forEach(kpi => {
    const card = document.createElement('article');
    card.className = `kpi-card accent-${kpi.accent || 'rms'}`;
    card.innerHTML = `
      <div class="kpi-meta">
        <span class="chip">${kpi.badge}</span>
        <p>${kpi.label}</p>
      </div>
      <p class="kpi-value">0</p>
      <p class="kpi-detail">${kpi.detail}</p>
    `;
    grid.appendChild(card);
    animateValue(card.querySelector('.kpi-value'), kpi.value);
  });
}

function animateValue(node, target) {
  let current = 0;
  const step = Math.max(1, Math.round(target / 40));
  const tick = () => {
    current += step;
    if (current >= target) {
      node.textContent = target;
      return;
    }
    node.textContent = current;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderWorkflows(workflows) {
  const container = document.getElementById('workflowGrid');
  if (!container) return;
  container.innerHTML = '';
  workflows.forEach(flow => {
    const card = document.createElement('article');
    card.className = 'workflow-card';
    const steps = flow.steps.map(step => `<li><a href="${step.url}" target="_blank" rel="noopener">${step.label}</a></li>`).join('');
    card.innerHTML = `
      <header>
        <p class="eyebrow">${flow.context}</p>
        <h3>${flow.title}</h3>
      </header>
      <ol>${steps}</ol>
    `;
    container.appendChild(card);
  });
}

// --- Timeline ---
function renderTimeline(items) {
  const list = document.getElementById('timelineList');
  if (!list) return;
  list.innerHTML = '';
  items.forEach(event => {
    const li = document.createElement('li');
    li.className = `timeline-item ${event.status}`;
    li.innerHTML = `
      <div>
        <p class="time">${event.time}</p>
        <h3>${event.title}</h3>
        <p>${event.detail}</p>
      </div>
    `;
    list.appendChild(li);
  });
}

// --- Services & méthode ---
function renderServices(services, method) {
  const grid = document.getElementById('servicesGrid');
  const list = document.getElementById('methodList');
  if (grid) {
    grid.innerHTML = '';
    services.forEach(service => {
      const card = document.createElement('article');
      card.className = 'service-card';
      card.innerHTML = `<h3>${service.title}</h3><p>${service.description}</p>`;
      grid.appendChild(card);
    });
  }
  if (list) {
    list.innerHTML = '';
    method.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${item.step}</strong> — ${item.detail}`;
      list.appendChild(li);
    });
  }
}

function renderFaq(faq) {
  const container = document.getElementById('faqList');
  if (!container) return;
  container.innerHTML = '';
  faq.forEach(entry => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = entry.question;
    const answer = document.createElement('p');
    answer.textContent = entry.answer;
    details.append(summary, answer);
    container.appendChild(details);
  });
}

// --- Toggles & interactions globales ---
function setupToolsMenu() {
  const toggle = document.getElementById('toolsToggle');
  const menu = document.getElementById('toolsMenu');
  if (!toggle || !menu) return;

  const closeMenu = () => {
    if (!menu.hasAttribute('hidden')) {
      menu.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isHidden = menu.hasAttribute('hidden');
    if (isHidden) {
      menu.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      closeMenu();
    }
  });

  menu.addEventListener('click', event => {
    event.stopPropagation();
    const link = event.target.closest('a');
    if (link) {
      closeMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target !== toggle && !menu.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

function setupMobileNav() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('primaryNav');
  const nav = document.querySelector('.top-nav');
  if (!toggle || !menu || !nav) return;

  const closeMenu = ({ immediate } = {}) => {
    if (toggle.getAttribute('aria-expanded') === 'false') return;
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    nav.classList.remove('menu-open');
    if (!immediate) {
      toggle.focus();
    }
  };

  const openMenu = () => {
    toggle.setAttribute('aria-expanded', 'true');
    menu.classList.add('is-open');
    nav.classList.add('menu-open');
  };

  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeMenu({ immediate: true });
    } else {
      openMenu();
    }
  });

  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMenu({ immediate: true }));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu({ immediate: true });
    }
  });

  document.addEventListener('click', (event) => {
    if (toggle.getAttribute('aria-expanded') === 'true' && !nav.contains(event.target)) {
      closeMenu({ immediate: true });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

function setupShareButtons() {
  const favoriteButton = document.getElementById('favoriteButton');
  const shareButton = document.getElementById('shareButton');

  favoriteButton?.addEventListener('click', () => {
    try {
      if (window.external && 'AddFavorite' in window.external) {
        window.external.AddFavorite(window.location.href, document.title);
      } else {
        alert('Utilise CTRL+D (Windows) ou CMD+D (Mac) pour enregistrer ce dashboard.');
      }
    } catch (error) {
      console.error(error);
    }
  });

  shareButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      shareButton.textContent = 'Lien copié';
      setTimeout(() => { shareButton.textContent = 'Partager'; }, 2000);
    } catch (error) {
      shareButton.textContent = 'Copie manuelle';
    }
  });
}

function setupObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.section').forEach(section => observer.observe(section));
}

function applyTikTokParams(proofs) {
  const params = new URLSearchParams(window.location.search);
  const fromTikTok = params.get('src') === 'tiktok';

  if (fromTikTok) {
    document.querySelectorAll('a[href^="http"]').forEach(anchor => {
      try {
        const url = new URL(anchor.href);
        url.searchParams.set('utm_source', 'tiktok');
        anchor.href = url.toString();
      } catch (error) {
        // ignore invalid URLs
      }
    });

    const proofSection = document.getElementById('tiktokProof');
    if (proofSection && proofs.length) {
      proofSection.removeAttribute('hidden');
      proofSection.classList.add('is-visible');
      proofSection.innerHTML = `
        <div class="section-head">
          <div>
            <p class="eyebrow">Vu sur TikTok</p>
            <h2>Ce que les viewers obtiennent ici</h2>
          </div>
          <p>3 preuves sociales pour rassurer l’audience TikTok.</p>
        </div>
      `;
      const grid = document.createElement('div');
      grid.className = 'proof-grid';
      proofs.slice(0, 3).forEach(proof => {
        const card = document.createElement('article');
        card.className = 'proof-card';
        card.innerHTML = `<h3>${proof.title}</h3><p><strong>${proof.result}</strong></p><p>${proof.detail}</p>`;
        grid.appendChild(card);
      });
      proofSection.appendChild(grid);
      const tip = document.createElement('p');
      tip.textContent = 'Astuce pro : promets une ressource ici, dis “dites LUMIA en DM” et passe tes liens avec ?src=tiktok pour adapter automatiquement l’expérience.';
      proofSection.appendChild(tip);
    }
  }
}

function setupAdCarousel() {
  const carousel = document.querySelector('[data-ad-carousel]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-carousel-track]');
  const slides = Array.from(track?.querySelectorAll('.ad-slide') || []);
  if (!slides.length) return;

  const prev = carousel.querySelector('[data-carousel-prev]');
  const next = carousel.querySelector('[data-carousel-next]');
  const indicators = carousel.querySelector('[data-carousel-indicators]');
  let currentIndex = 0;
  let autoRotate;

  const update = (index) => {
    slides.forEach((slide, idx) => {
      slide.classList.toggle('is-active', idx === index);
    });
    indicators?.querySelectorAll('button').forEach((button, idx) => {
      button.classList.toggle('is-active', idx === index);
      button.setAttribute('aria-pressed', String(idx === index));
    });
  };

  const goTo = (index) => {
    currentIndex = (index + slides.length) % slides.length;
    update(currentIndex);
  };

  const resetAutoRotate = () => {
    if (autoRotate) clearInterval(autoRotate);
    autoRotate = setInterval(() => goTo(currentIndex + 1), 8000);
  };

  prev?.addEventListener('click', () => {
    goTo(currentIndex - 1);
    resetAutoRotate();
  });

  next?.addEventListener('click', () => {
    goTo(currentIndex + 1);
    resetAutoRotate();
  });

  if (indicators) {
    slides.forEach((_, idx) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Aller au slide ${idx + 1}`);
      button.addEventListener('click', () => {
        goTo(idx);
        resetAutoRotate();
      });
      indicators.appendChild(button);
    });
  }

  carousel.addEventListener('mouseenter', () => autoRotate && clearInterval(autoRotate));
  carousel.addEventListener('mouseleave', resetAutoRotate);

  update(currentIndex);
  resetAutoRotate();
}

// --- Détection de liens non configurés ---
function shouldDisable(url) {
  if (!url || url === '#') return true;
  return PRIVATE_PATTERNS.some(pattern => pattern.test(url));
}
