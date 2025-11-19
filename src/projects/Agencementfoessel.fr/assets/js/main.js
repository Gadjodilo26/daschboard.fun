// main.js — effets UI et accessibilité pour la landing

// ====== Année courante ======
const yearEl = document.getElementById('y');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ====== Fonds de sections avec fondu ======
const backgroundStack = document.querySelector('.background-stack');
const backgroundLayers = backgroundStack ? Array.from(backgroundStack.querySelectorAll('.background-layer')) : [];
const backgroundElements = Array.from(document.querySelectorAll('[data-bg]'));
let activeLayerIndex = 0;
let currentBackground = null;

function swapBackground(url) {
  if (!url || !backgroundLayers.length || url === currentBackground) return;
  const nextIndex = (activeLayerIndex + 1) % backgroundLayers.length;
  const nextLayer = backgroundLayers[nextIndex];
  const currentLayer = backgroundLayers[activeLayerIndex];

  const applyBackground = () => {
    nextLayer.dataset.bgSrc = url;
    nextLayer.style.backgroundImage = `url("${url}")`;
    requestAnimationFrame(() => {
      nextLayer.classList.add('is-active');
      if (currentLayer !== nextLayer) currentLayer.classList.remove('is-active');
    });
    activeLayerIndex = nextIndex;
    currentBackground = url;
  };

  if (nextLayer.dataset.bgSrc === url) {
    applyBackground();
    return;
  }

  const img = new Image();
  img.addEventListener('load', applyBackground, { once: true });
  img.addEventListener('error', applyBackground, { once: true });
  img.src = url;
}

if (backgroundLayers.length && backgroundElements.length) {
  const initialUrl = backgroundElements[0]?.dataset.bg;

  if (initialUrl) {
    backgroundLayers[0].style.backgroundImage = `url("${initialUrl}")`;
    backgroundLayers[0].dataset.bgSrc = initialUrl;
    backgroundLayers[0].classList.add('is-active');
    currentBackground = initialUrl;
  }

  const bgObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting && entry.target.dataset.bg)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    const candidate = visible[0];

    if (candidate) swapBackground(candidate.target.dataset.bg);
  }, {
    threshold: [0.25, 0.5, 0.75],
    rootMargin: '-25% 0px -40% 0px'
  });

  backgroundElements.forEach((el) => bgObserver.observe(el));
}

// ====== Carrousels dynamiques ======
const carouselData = (typeof window !== 'undefined' && window.CAROUSEL_DATA) || {};

function formatLabel(label) {
  return label
    .replace(/([A-ZÉÈÊËÎÏÔÖÙÜÇ])/g, ' $1')
    .replace(/&/g, ' & ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function createCarousel(projectInfo, context) {
  const { type, projectLabel } = context;
  const total = projectInfo.images.length;
  const carousel = document.createElement('div');
  carousel.className = 'carousel';
  carousel.dataset.carousel = '';
  carousel.tabIndex = 0;
  if (total <= 3) carousel.dataset.size = 'compact';

  const header = document.createElement('div');
  header.className = 'carousel-header';

  const title = document.createElement('h4');
  title.textContent = projectLabel;
  header.appendChild(title);

  const meta = document.createElement('span');
  meta.textContent = type;
  header.appendChild(meta);

  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  viewport.setAttribute('aria-live', 'polite');

  const track = document.createElement('div');
  track.className = 'carousel-track';

  projectInfo.images.forEach((image, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';

    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = `${type} – ${projectLabel}, vue ${idx + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    figure.appendChild(img);

    const caption = document.createElement('figcaption');
    caption.textContent = `${projectLabel} · Vue ${idx + 1}`;
    figure.appendChild(caption);

    slide.appendChild(figure);
    track.appendChild(slide);
  });

  viewport.appendChild(track);

  const nav = document.createElement('div');
  nav.className = 'carousel-nav';

  const actions = document.createElement('div');
  actions.className = 'carousel-actions';

  const prev = document.createElement('button');
  prev.className = 'carousel-btn';
  prev.type = 'button';
  prev.dataset.action = 'prev';
  prev.setAttribute('aria-label', 'Photo précédente');
  prev.innerHTML = '&#8592;';

  const next = document.createElement('button');
  next.className = 'carousel-btn';
  next.type = 'button';
  next.dataset.action = 'next';
  next.setAttribute('aria-label', 'Photo suivante');
  next.innerHTML = '&#8594;';

  actions.append(prev, next);

  const dots = document.createElement('div');
  dots.className = 'carousel-dots';

  projectInfo.images.forEach((_, idx) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.dataset.index = String(idx);
    dot.setAttribute('aria-label', `Aller à la vue ${idx + 1}`);
    dots.appendChild(dot);
  });

  const counter = document.createElement('span');
  counter.className = 'carousel-counter';
  counter.dataset.counter = '';

  nav.append(actions, dots, counter);

  carousel.append(header, viewport, nav);
  return carousel;
}

function initCarousel(carousel) {
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = carousel.querySelector('.carousel-track');
  const slides = Array.from(track.children);
  const prev = carousel.querySelector('[data-action="prev"]');
  const next = carousel.querySelector('[data-action="next"]');
  const dots = Array.from(carousel.querySelectorAll('.carousel-dot'));
  const counter = carousel.querySelector('[data-counter]');
  const total = slides.length;
  let index = 0;

  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === total - 1;
    dots.forEach((dot, idx) => dot.classList.toggle('is-active', idx === index));
    if (counter) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  }

  function goTo(newIndex) {
    if (newIndex < 0 || newIndex >= total || newIndex === index) return;
    index = newIndex;
    update();
  }

  prev?.addEventListener('click', () => goTo(index - 1));
  next?.addEventListener('click', () => goTo(index + 1));
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const targetIndex = Number(dot.dataset.index);
      if (!Number.isNaN(targetIndex)) goTo(targetIndex);
    });
  });

  if (viewport && total > 1) {
    let isDragging = false;
    let isPointerCaptured = false;
    let startX = 0;
    let startY = 0;
    let deltaX = 0;

    const releasePointer = (event) => {
      if (isPointerCaptured && typeof viewport.releasePointerCapture === 'function' && event?.pointerId !== undefined) {
        try {
          viewport.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore release errors
        }
      }
      isPointerCaptured = false;
    };

    const cancelDrag = (event) => {
      if (!isDragging) return;
      isDragging = false;
      deltaX = 0;
      viewport.classList.remove('is-dragging');
      track.style.transition = '';
      releasePointer(event);
      update();
    };

    const handlePointerDown = (event) => {
      if (!event.isPrimary) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      deltaX = 0;
      track.style.transition = 'none';
      viewport.classList.add('is-dragging');
      if (typeof viewport.setPointerCapture === 'function') {
        try {
          viewport.setPointerCapture(event.pointerId);
          isPointerCaptured = true;
        } catch (error) {
          isPointerCaptured = false;
        }
      }
    };

    const handlePointerMove = (event) => {
      if (!isDragging || !event.isPrimary) return;
      const viewportWidth = viewport.offsetWidth || 1;
      deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 12) {
        cancelDrag(event);
        return;
      }
      const movePercent = (deltaX / viewportWidth) * 100;
      track.style.transform = `translateX(${(-index * 100) + movePercent}%)`;
    };

    const handlePointerEnd = (event) => {
      if (!isDragging || !event.isPrimary) return;
      isDragging = false;
      viewport.classList.remove('is-dragging');
      track.style.transition = '';
      const previousIndex = index;
      const threshold = (viewport.offsetWidth || 1) * 0.18;
      if (Math.abs(deltaX) > threshold) {
        if (deltaX < 0) {
          goTo(index + 1);
        } else {
          goTo(index - 1);
        }
      }
      if (index === previousIndex) update();
      deltaX = 0;
      releasePointer(event);
    };

    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerup', handlePointerEnd);
    viewport.addEventListener('pointercancel', cancelDrag);
    viewport.addEventListener('pointerleave', (event) => {
      if (isDragging && event.isPrimary && event.pointerType === 'mouse') handlePointerEnd(event);
    });
  }

  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(Math.min(index + 1, total - 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(Math.max(index - 1, 0));
    }
  });

  update();
}

document.addEventListener('DOMContentLoaded', () => {
  const carouselRoot = document.querySelector('[data-carousels]');
  if (!carouselRoot || !Object.keys(carouselData).length) return;

  const typePriority = ['Intérieur', 'Extérieur'];
  const typeEntries = Object.entries(carouselData)
    .sort(([a], [b]) => {
      const indexA = typePriority.includes(a) ? typePriority.indexOf(a) : Number.MAX_SAFE_INTEGER;
      const indexB = typePriority.includes(b) ? typePriority.indexOf(b) : Number.MAX_SAFE_INTEGER;
      if (indexA !== indexB) return indexA - indexB;
      return a.localeCompare(b, 'fr', { sensitivity: 'base' });
    });

  typeEntries.forEach(([type, projects]) => {
    const group = document.createElement('article');
    group.className = 'carousel-group';

    const heading = document.createElement('h3');
    heading.textContent = formatLabel(type);
    group.appendChild(heading);

    const projectEntries = Object.entries(projects)
      .sort(([, infoA], [, infoB]) => infoB.date.localeCompare(infoA.date));

    projectEntries.forEach(([project, info]) => {
      const carousel = createCarousel(info, {
        type: formatLabel(type),
        projectLabel: formatLabel(project)
      });
      group.appendChild(carousel);
      initCarousel(carousel);
    });

    carouselRoot.appendChild(group);
  });
});

// ====== Préformulaire de contact ======
const precontactForm = document.getElementById('precontact-form');
const targetMail = 'fm.multiservices@outlook.fr';

if (precontactForm) {
  precontactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(precontactForm);
    const name = formData.get('name')?.toString().trim() || '';
    const email = formData.get('email')?.toString().trim() || '';
    const phone = formData.get('phone')?.toString().trim() || '';
    const type = formData.get('type')?.toString().trim() || '';
    const details = formData.get('details')?.toString().trim() || '';

    if (!name || !email || !type || !details) return;

    const subject = `Projet ${type} – ${name}`;
    const lines = [
      `Bonjour,`,
      ``,
      `Je souhaiterais échanger au sujet du projet suivant :`,
      `Type de projet : ${type}`,
      `Détails : ${details}`,
      ``,
      `Mes coordonnées :`,
      `Nom : ${name}`,
      `Email : ${email}`,
      phone ? `Téléphone : ${phone}` : null,
      ``,
      `Merci et à bientôt.`
    ].filter(Boolean);

    const body = lines.join('\n');
    const mailto = `mailto:${encodeURIComponent(targetMail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;

    setTimeout(() => {
      precontactForm.reset();
    }, 400);
  });
}

// ====== Apparitions au scroll ======
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ====== Barre de progression lecture ======
const bar = document.getElementById('progress');
function onScroll() {
  const h = document.documentElement;
  const p = (h.scrollTop) / (h.scrollHeight - h.clientHeight || 1);
  if (bar) bar.style.transform = `scaleX(${p})`;
}
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ====== Liens internes lisses ======
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id && id.length > 1) {
      e.preventDefault();
      document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ====== Sélecteur de fond (persisté) ======
const bgSelect = document.getElementById('bgSelect');
const body = document.body;

function applyBg(val) {
  body.classList.remove('bg-fine', 'bg-large', 'bg-none');
  body.classList.add(val);
}

const savedBg = localStorage.getItem('bgVariant');
if (savedBg) {
  applyBg(savedBg);
  if (bgSelect) bgSelect.value = savedBg;
}

if (bgSelect) {
  bgSelect.addEventListener('change', () => {
    const val = bgSelect.value;
    localStorage.setItem('bgVariant', val);
    applyBg(val);
  });
}

// ====== Menu burger accessible (focus trap + ESC + clic hors zone) ======
const burger = document.querySelector('.burger');
const menu = document.getElementById('primary-nav');

let restoreFocusEl = null;

function getFocusables(root) {
  return Array.from(root.querySelectorAll(
    'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

function trapTab(e) {
  if (e.key !== 'Tab') return;
  const focusables = getFocusables(menu);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

function onEsc(e) {
  if (e.key === 'Escape') setMenu(false);
}

function onClickOutside(e) {
  if (!menu.contains(e.target) && !burger.contains(e.target)) setMenu(false);
}

function setMenu(open) {
  if (!burger || !menu) return;
  burger.classList.toggle('is-open', open);
  menu.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));

  if (open) {
    restoreFocusEl = document.activeElement;
    const firstLink = menu.querySelector('a');
    firstLink?.focus();
    document.addEventListener('keydown', trapTab);
    document.addEventListener('keydown', onEsc);
    document.addEventListener('click', onClickOutside);
  } else {
    document.removeEventListener('keydown', trapTab);
    document.removeEventListener('keydown', onEsc);
    document.removeEventListener('click', onClickOutside);
    (restoreFocusEl || burger).focus?.();
  }
}

burger?.addEventListener('click', () =>
  setMenu(!menu.classList.contains('is-open'))
);

// Fermeture auto au-dessus du breakpoint
const mq = window.matchMedia('(min-width: 861px)');
mq.addEventListener('change', () => { if (mq.matches) setMenu(false); });
