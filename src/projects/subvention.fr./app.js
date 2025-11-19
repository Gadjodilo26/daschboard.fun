/**
 * README – Moteur de recherche de subventions
 * -------------------------------------------------
 * - Le fichier charge les données depuis data/grants.json via fetch et
 *   construit un index de recherche plein texte (tokenisation FR + IDF léger).
 * - Le state (recherche, filtres, tri, pagination) est synchronisé dans l’URL
 *   et persisté dans localStorage pour restaurer la dernière session.
 * - Les favoris sont conservés en localStorage et affichés dans le panneau dédié.
 * - Pour remplacer data/grants.json par des données réelles, assurez-vous de
 *   respecter le schéma { id, title, source, level, region, sectors, naf,
 *   audience, eligibility, amount, deadline, updated_at, link, tags, documents }.
 *   Aucun autre changement n’est requis : l’application détecte dynamiquement
 *   les filtres et se met à jour automatiquement.
 */

(() => {
  const DATA_URL = 'data/grants.json';
  const STATE_STORAGE_KEY = 'grantSearch:state:v1';
  const FAVORITES_STORAGE_KEY = 'grantSearch:favorites:v1';
  const DEBOUNCE_DELAY = 300;
  const RANGE_DEBOUNCE_DELAY = 400;
  const STOPWORDS = new Set([
    'alors', 'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en',
    'et', 'eux', 'il', 'je', 'la', 'le', 'les', 'leur', 'lui', 'ma', 'mais', 'me', 'moi',
    'mon', 'ne', 'nos', 'notre', 'nous', 'on', 'ou', 'par', 'pas', 'pour', 'qu', 'que',
    'qui', 'sa', 'se', 'ses', 'son', 'sur', 'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un',
    'une', 'vos', 'votre', 'vous', 'y', 'à', 'aujourd', 'hui', 'dès', 'afin', 'ainsi',
    'entre', 'plus', 'moins', 'être', 'avoir', 'fait', 'faites', 'faits'
  ]);
  const LEVEL_ORDER = ['national', 'régional', 'local', 'européen'];
  const TYPE_ORDER = ['subvention', 'avance', 'prêt'];

  const defaultState = {
    query: '',
    regions: new Set(),
    sectors: new Set(),
    audiences: new Set(),
    tags: new Set(),
    naf: new Set(),
    types: new Set(),
    level: '',
    amountMin: null,
    amountMax: null,
    deadlineAfter: '',
    deadlineBefore: '',
    sort: 'relevance',
    page: 1,
    pageSize: 10
  };

  const quickFilters = [
    {
      label: 'Formation & reconversion',
      state: {
        query: 'formation',
        tags: ['formation'],
        sectors: ['enseignement']
      }
    },
    {
      label: 'Industrie décarbonée',
      state: {
        sectors: ['industrie'],
        tags: ['décarbonation']
      }
    },
    {
      label: 'Culture & spectacle vivant',
      state: {
        sectors: ['culture'],
        tags: ['spectacle']
      }
    },
    {
      label: 'Mobilité & VTC',
      state: {
        sectors: ['VTC'],
        tags: ['transport']
      }
    }
  ];

  const elements = {
    searchInput: document.getElementById('global-search'),
    filtersForm: document.getElementById('filters-form'),
    resultsList: document.getElementById('results-list'),
    resultsCount: document.getElementById('results-count'),
    resultsSection: document.getElementById('results'),
    emptyState: document.getElementById('empty-state'),
    pagination: document.getElementById('pagination'),
    sortSelect: document.getElementById('sort-select'),
    pageSizeSelect: document.getElementById('page-size'),
    resetFilters: document.getElementById('reset-filters'),
    activeFilters: document.getElementById('active-filters'),
    clearActiveFilters: document.getElementById('clear-active-filters'),
    favoritesPanel: document.getElementById('favorites-panel'),
    favoritesList: document.getElementById('favorites-list'),
    favoritesCount: document.getElementById('favorites-count'),
    clearFavorites: document.getElementById('clear-favorites'),
    announcer: document.getElementById('announcer'),
    quickFilters: document.getElementById('quick-filters')
  };

  const filterContainers = {
    regions: document.getElementById('filter-regions'),
    level: document.getElementById('filter-levels'),
    sectors: document.getElementById('filter-sectors'),
    audiences: document.getElementById('filter-audiences'),
    types: document.getElementById('filter-types'),
    tags: document.getElementById('filter-tags'),
    naf: document.getElementById('filter-naf')
  };

  const rangeInputs = {
    amountMin: document.getElementById('amount-min'),
    amountMax: document.getElementById('amount-max'),
    deadlineAfter: document.getElementById('deadline-after'),
    deadlineBefore: document.getElementById('deadline-before')
  };

  let state = cloneState(defaultState);
  let favorites = new Set();
  let grants = [];
  let grantMap = new Map();
  let searchIndex = new Map();
  let documentFrequency = new Map();
  let dataLoaded = false;

  const filterOptions = {
    regions: [],
    sectors: [],
    audiences: [],
    tags: [],
    naf: [],
    types: [],
    level: LEVEL_ORDER.slice()
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadFavorites();
    const restoredState = restoreStateFromUrlOrStorage();
    if (restoredState) {
      state = restoredState;
    }
    syncInputsFromState();
    renderQuickFilters();
    attachEventListeners();
    fetchData();
  }

  function attachEventListeners() {
    if (elements.searchInput) {
      const debouncedSearch = debounce((value) => {
        state.query = value.trim();
        state.page = 1;
        refresh();
      }, DEBOUNCE_DELAY);
      elements.searchInput.addEventListener('input', (event) => {
        debouncedSearch(event.target.value);
      });
    }

    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', (event) => {
        state.sort = event.target.value;
        state.page = 1;
        refresh({ preservePage: true });
        announce(`Tri appliqué : ${event.target.selectedOptions[0].textContent}`);
      });
    }

    if (elements.pageSizeSelect) {
      elements.pageSizeSelect.addEventListener('change', (event) => {
        state.pageSize = Number(event.target.value) || 10;
        state.page = 1;
        refresh();
      });
    }

    if (elements.resetFilters) {
      elements.resetFilters.addEventListener('click', () => {
        resetAll();
      });
    }

    if (elements.clearActiveFilters) {
      elements.clearActiveFilters.addEventListener('click', () => {
        clearFilters();
        refresh();
      });
    }

    if (elements.clearFavorites) {
      elements.clearFavorites.addEventListener('click', () => {
        if (!favorites.size) {
          return;
        }
        favorites.clear();
        persistFavorites();
        renderFavorites();
        announce('Favoris vidés.');
        refresh({ skipPersist: true });
      });
    }

    if (elements.pagination) {
      elements.pagination.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]');
        if (!button) {
          return;
        }
        event.preventDefault();
        const nextPage = Number(button.dataset.page);
        if (!Number.isNaN(nextPage) && nextPage !== state.page) {
          state.page = nextPage;
          refresh({ skipPersist: true, skipUrl: false, preservePage: true });
          elements.pagination.querySelector('[aria-current="page"]')?.focus();
        }
      });
    }

    if (elements.resultsList) {
      elements.resultsList.addEventListener('click', async (event) => {
        const copyButton = event.target.closest('button[data-action="copy-link"]');
        const favoriteButton = event.target.closest('button[data-action="toggle-favorite"]');

        if (copyButton) {
          event.preventDefault();
          const link = copyButton.getAttribute('data-link');
          if (link) {
            const success = await copyToClipboard(link);
            announce(success ? 'Lien copié dans le presse-papiers.' : 'Impossible de copier le lien.');
          }
          return;
        }

        if (favoriteButton) {
          event.preventDefault();
          const id = favoriteButton.getAttribute('data-id');
          if (!id) {
            return;
          }
          if (favorites.has(id)) {
            favorites.delete(id);
            announce('Subvention retirée des favoris.');
          } else {
            favorites.add(id);
            announce('Subvention ajoutée aux favoris.');
          }
          persistFavorites();
          renderFavorites();
          refresh({ skipPersist: true, skipUrl: true, preservePage: true });
        }
      });
    }

    if (elements.favoritesList) {
      elements.favoritesList.addEventListener('click', (event) => {
        const removeButton = event.target.closest('button[data-action="remove-favorite"]');
        if (!removeButton) {
          return;
        }
        const id = removeButton.getAttribute('data-id');
        if (!id) {
          return;
        }
        favorites.delete(id);
        persistFavorites();
        renderFavorites();
        refresh({ skipPersist: true, skipUrl: true, preservePage: true });
        announce('Favori retiré.');
      });
    }

    if (elements.quickFilters) {
      elements.quickFilters.addEventListener('click', (event) => {
        const chip = event.target.closest('button[data-quick]');
        if (!chip) {
          return;
        }
        const index = Number(chip.dataset.quick);
        const preset = quickFilters[index];
        if (!preset) {
          return;
        }
        applyQuickFilter(preset.state);
        announce(`Raccourci appliqué : ${preset.label}`);
      });
    }

    if (elements.filtersForm) {
      elements.filtersForm.addEventListener('click', (event) => {
        const element = event.target.closest('button[data-filter-key]');
        if (!element) {
          return;
        }
        const key = element.dataset.filterKey;
        const value = element.dataset.value;
        const type = element.dataset.filterType;
        if (!key || typeof value === 'undefined') {
          return;
        }
        handleFilterToggle(key, value, type);
      });

      const debouncedRangeUpdate = debounce(() => {
        handleRangeChange();
      }, RANGE_DEBOUNCE_DELAY);

      elements.filtersForm.addEventListener('input', (event) => {
        if (event.target instanceof HTMLInputElement && event.target.dataset.range) {
          debouncedRangeUpdate();
        }
      });

      elements.filtersForm.addEventListener('change', (event) => {
        if (event.target instanceof HTMLInputElement && event.target.dataset.range) {
          handleRangeChange();
        }
      });
    }
  }

  function applyQuickFilter(preset) {
    clearFilters();
    const newQuery = typeof preset.query === 'string' ? preset.query : '';
    state.query = newQuery;
    if (elements.searchInput) {
      elements.searchInput.value = newQuery;
    }

    ['regions', 'sectors', 'audiences', 'tags', 'naf', 'types'].forEach((key) => {
      const values = preset[key];
      if (!values || !Array.isArray(values)) {
        return;
      }
      values.forEach((value) => {
        state[key].add(value);
      });
    });

    if (preset.level) {
      state.level = preset.level;
    }

    state.page = 1;
    refresh();
  }

  function handleRangeChange() {
    const min = sanitizeNumber(rangeInputs.amountMin.value);
    const max = sanitizeNumber(rangeInputs.amountMax.value);
    const deadlineAfter = rangeInputs.deadlineAfter.value || '';
    const deadlineBefore = rangeInputs.deadlineBefore.value || '';

    state.amountMin = min;
    state.amountMax = max;
    state.deadlineAfter = deadlineAfter;
    state.deadlineBefore = deadlineBefore;
    state.page = 1;
    refresh();
  }

  function sanitizeNumber(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  function handleFilterToggle(key, value, type) {
    if (!Object.prototype.hasOwnProperty.call(state, key)) {
      return;
    }
    if (type === 'single') {
      state.level = state.level === value ? '' : value;
    } else {
      const targetSet = state[key];
      if (!(targetSet instanceof Set)) {
        return;
      }
      if (targetSet.has(value)) {
        targetSet.delete(value);
      } else {
        targetSet.add(value);
      }
    }
    state.page = 1;
    refresh();
  }

  function clearFilters() {
    state.regions.clear();
    state.sectors.clear();
    state.audiences.clear();
    state.tags.clear();
    state.naf.clear();
    state.types.clear();
    state.level = '';
    state.amountMin = null;
    state.amountMax = null;
    state.deadlineAfter = '';
    state.deadlineBefore = '';
    state.page = 1;
    syncInputsFromState();
  }

  function resetAll() {
    state = cloneState(defaultState);
    syncInputsFromState();
    favorites = new Set(favorites); // keep favorites intact
    refresh();
    announce('Recherche réinitialisée.');
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) {
        favorites = new Set();
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        favorites = new Set(parsed);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des favoris', error);
      favorites = new Set();
    }
  }

  function persistFavorites() {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    } catch (error) {
      console.error('Erreur enregistrement favoris', error);
    }
  }

  function restoreStateFromUrlOrStorage() {
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlState = Array.from(urlParams.keys()).length > 0;
    if (hasUrlState) {
      return applyParamsToState(urlParams);
    }

    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return hydrateState(parsed);
    } catch (error) {
      console.error('Erreur restauration state', error);
      return null;
    }
  }

  function applyParamsToState(params) {
    const hydrated = cloneState(defaultState);
    const parseSetParam = (name) => {
      const values = params.getAll(`${name}[]`);
      if (values.length) {
        values.forEach((value) => hydrated[name].add(value));
        return;
      }
      const single = params.get(name);
      if (single) {
        hydrated[name].add(single);
      }
    };

    hydrated.query = params.get('q') ? params.get('q').trim() : '';

    ['regions', 'sectors', 'audiences', 'tags', 'naf', 'types'].forEach(parseSetParam);

    const level = params.get('level');
    hydrated.level = level || '';

    const amountMin = sanitizeNumber(params.get('amountMin'));
    const amountMax = sanitizeNumber(params.get('amountMax'));
    hydrated.amountMin = amountMin;
    hydrated.amountMax = amountMax;

    hydrated.deadlineAfter = params.get('deadlineAfter') || '';
    hydrated.deadlineBefore = params.get('deadlineBefore') || '';

    hydrated.sort = params.get('sort') || 'relevance';
    const page = Number(params.get('page'));
    const pageSize = Number(params.get('pageSize'));
    hydrated.page = Number.isInteger(page) && page > 0 ? page : 1;
    hydrated.pageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
    return hydrated;
  }

  function hydrateState(rawState) {
    const hydrated = cloneState(defaultState);
    if (!rawState || typeof rawState !== 'object') {
      return hydrated;
    }
    hydrated.query = typeof rawState.query === 'string' ? rawState.query : '';
    const assignSet = (key) => {
      if (Array.isArray(rawState[key])) {
        rawState[key].forEach((value) => hydrated[key].add(value));
      }
    };
    ['regions', 'sectors', 'audiences', 'tags', 'naf', 'types'].forEach(assignSet);
    if (typeof rawState.level === 'string') {
      hydrated.level = rawState.level;
    }
    hydrated.amountMin = typeof rawState.amountMin === 'number' ? rawState.amountMin : null;
    hydrated.amountMax = typeof rawState.amountMax === 'number' ? rawState.amountMax : null;
    hydrated.deadlineAfter = typeof rawState.deadlineAfter === 'string' ? rawState.deadlineAfter : '';
    hydrated.deadlineBefore = typeof rawState.deadlineBefore === 'string' ? rawState.deadlineBefore : '';
    hydrated.sort = typeof rawState.sort === 'string' ? rawState.sort : 'relevance';
    hydrated.page = Number.isInteger(rawState.page) && rawState.page > 0 ? rawState.page : 1;
    hydrated.pageSize = Number.isInteger(rawState.pageSize) && rawState.pageSize > 0 ? rawState.pageSize : 10;
    return hydrated;
  }

  function persistState() {
    try {
      const serializable = {
        ...state,
        regions: Array.from(state.regions),
        sectors: Array.from(state.sectors),
        audiences: Array.from(state.audiences),
        tags: Array.from(state.tags),
        naf: Array.from(state.naf),
        types: Array.from(state.types)
      };
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error('Erreur enregistrement state', error);
    }
  }

  async function fetchData() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Impossible de charger les données (${response.status})`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('Le fichier JSON doit contenir un tableau.');
      }
      grants = payload;
      grantMap = new Map(payload.map((grant) => [grant.id, grant]));
      buildFilterOptions();
      buildSearchIndex(payload);
      dataLoaded = true;
      renderFavorites();
      refresh();
    } catch (error) {
      console.error(error);
      elements.resultsCount.textContent = 'Erreur : impossible de charger les subventions.';
      elements.emptyState.hidden = false;
      elements.emptyState.querySelector('p').textContent = 'Une erreur est survenue lors du chargement des données. Réessayez plus tard.';
    }
  }

  function cloneState(template) {
    return {
      query: template.query,
      regions: new Set(template.regions),
      sectors: new Set(template.sectors),
      audiences: new Set(template.audiences),
      tags: new Set(template.tags),
      naf: new Set(template.naf),
      types: new Set(template.types),
      level: template.level,
      amountMin: template.amountMin,
      amountMax: template.amountMax,
      deadlineAfter: template.deadlineAfter,
      deadlineBefore: template.deadlineBefore,
      sort: template.sort,
      page: template.page,
      pageSize: template.pageSize
    };
  }

  function buildFilterOptions() {
    const regions = new Set();
    const sectors = new Set();
    const audiences = new Set();
    const tags = new Set();
    const naf = new Set();
    const types = new Set();

    grants.forEach((grant) => {
      if (grant.region) {
        regions.add(grant.region);
      }
      if (Array.isArray(grant.sectors)) {
        grant.sectors.forEach((item) => sectors.add(item));
      }
      if (Array.isArray(grant.audience)) {
        grant.audience.forEach((item) => audiences.add(item));
      }
      if (Array.isArray(grant.tags)) {
        grant.tags.forEach((item) => tags.add(item));
      }
      if (Array.isArray(grant.naf)) {
        grant.naf.forEach((item) => naf.add(item));
      }
      if (grant.amount && grant.amount.type) {
        types.add(grant.amount.type);
      }
    });

    filterOptions.regions = Array.from(regions).sort((a, b) => a.localeCompare(b, 'fr'));
    filterOptions.sectors = Array.from(sectors).sort((a, b) => a.localeCompare(b, 'fr'));
    filterOptions.audiences = Array.from(audiences).sort((a, b) => a.localeCompare(b, 'fr'));
    filterOptions.tags = Array.from(tags).sort((a, b) => a.localeCompare(b, 'fr'));
    filterOptions.naf = Array.from(naf).sort();
    filterOptions.types = Array.from(types).sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b));
  }

  function buildSearchIndex(items) {
    searchIndex.clear();
    documentFrequency.clear();

    items.forEach((grant) => {
      const tokens = new Map();
      const fields = [
        { key: 'title', weight: 4 },
        { key: 'source', weight: 2.5 },
        { key: 'eligibility', weight: 1 },
        { key: 'region', weight: 1.5 },
        { key: 'level', weight: 1.2 },
        { key: 'sectors', weight: 2 },
        { key: 'tags', weight: 1.5 }
      ];

      const seenTokens = new Set();

      fields.forEach(({ key, weight }) => {
        let value = grant[key];
        if (!value) {
          return;
        }
        if (Array.isArray(value)) {
          value = value.join(' ');
        }
        const fieldTokens = tokenize(value);
        const counts = countTokens(fieldTokens);
        Object.entries(counts).forEach(([token, count]) => {
          const current = tokens.get(token) || 0;
          tokens.set(token, current + count * weight);
          seenTokens.add(token);
        });
      });

      seenTokens.forEach((token) => {
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      });

      searchIndex.set(grant.id, tokens);
    });
  }

  function countTokens(list) {
    const map = Object.create(null);
    list.forEach((token) => {
      map[token] = (map[token] || 0) + 1;
    });
    return map;
  }

  function refresh(options = {}) {
    if (!dataLoaded) {
      return;
    }

    const queryTokens = tokenize(state.query);
    const filtered = applyFilters(grants, state);
    let results = computeSearch(filtered, queryTokens);
    results = sortResults(results, state.sort);

    const total = results.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) {
      state.page = totalPages;
    }

    const pageStart = (state.page - 1) * state.pageSize;
    const paginated = results.slice(pageStart, pageStart + state.pageSize);

    renderResults(paginated, queryTokens);
    renderPagination(totalPages, total);
    renderActiveFilters(queryTokens);
    renderFilterGroups(queryTokens);
    updateResultsCount(total, totalPages);
    updateEmptyState(total);

    if (!options.skipUrl) {
      syncUrl();
    }
    if (!options.skipPersist) {
      persistState();
    }
  }

  function applyFilters(list, currentState) {
    return list.filter((grant) => {
      if (currentState.regions.size && !currentState.regions.has(grant.region)) {
        return false;
      }
      if (currentState.level && grant.level !== currentState.level) {
        return false;
      }
      if (currentState.sectors.size && !arrayIntersect(grant.sectors, currentState.sectors)) {
        return false;
      }
      if (currentState.audiences.size && !arrayIntersect(grant.audience, currentState.audiences)) {
        return false;
      }
      if (currentState.types.size && (!grant.amount || !currentState.types.has(grant.amount.type))) {
        return false;
      }
      if (currentState.tags.size && !arrayIntersect(grant.tags, currentState.tags)) {
        return false;
      }
      if (currentState.naf.size && !arrayIntersect(grant.naf, currentState.naf)) {
        return false;
      }
      if (currentState.amountMin !== null) {
        const max = grant.amount?.max ?? 0;
        if (max < currentState.amountMin) {
          return false;
        }
      }
      if (currentState.amountMax !== null) {
        const min = grant.amount?.min ?? 0;
        if (min > currentState.amountMax) {
          return false;
        }
      }
      if (currentState.deadlineAfter) {
        const grantDeadline = grant.deadline ? new Date(grant.deadline).getTime() : null;
        const filterDate = new Date(currentState.deadlineAfter).getTime();
        if (!grantDeadline || grantDeadline < filterDate) {
          return false;
        }
      }
      if (currentState.deadlineBefore) {
        const grantDeadline = grant.deadline ? new Date(grant.deadline).getTime() : null;
        const filterDate = new Date(currentState.deadlineBefore).getTime();
        if (!grantDeadline || grantDeadline > filterDate) {
          return false;
        }
      }
      return true;
    });
  }

  function arrayIntersect(values, set) {
    if (!Array.isArray(values)) {
      return false;
    }
    return values.some((value) => set.has(value));
  }

  function computeSearch(list, tokens) {
    if (!tokens.length) {
      return list.map((grant) => ({ grant, score: 0, matchedTokens: [] }));
    }

    const totalDocs = grants.length || 1;

    return list
      .map((grant) => {
        const weights = searchIndex.get(grant.id);
        if (!weights) {
          return { grant, score: 0, matchedTokens: [] };
        }
        let score = 0;
        const matchedTokens = [];
        tokens.forEach((token) => {
          const tf = weights.get(token) || 0;
          if (!tf) {
            return;
          }
          const df = documentFrequency.get(token) || 1;
          const idf = Math.log((1 + totalDocs) / (1 + df)) + 1;
          score += tf * idf;
          matchedTokens.push(token);
        });
        return { grant, score, matchedTokens };
      })
      .filter((item) => (tokens.length ? item.score > 0 : true));
  }

  function sortResults(items, sortKey) {
    const sorted = [...items];
    const validityComparator = (a, b) => {
      const aExpired = grantExpired(a.grant);
      const bExpired = grantExpired(b.grant);
      if (aExpired === bExpired) {
        return 0;
      }
      return aExpired ? 1 : -1;
    };

    if (sortKey === 'relevance') {
      sorted.sort((a, b) => {
        const validity = validityComparator(a, b);
        if (validity !== 0) {
          return validity;
        }
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const dateB = b.grant.updated_at ? Date.parse(b.grant.updated_at) : 0;
        const dateA = a.grant.updated_at ? Date.parse(a.grant.updated_at) : 0;
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        return a.grant.title.localeCompare(b.grant.title, 'fr');
      });
      return sorted;
    }

    if (sortKey === 'updated_at') {
      sorted.sort((a, b) => {
        const validity = validityComparator(a, b);
        if (validity !== 0) {
          return validity;
        }
        const dateB = b.grant.updated_at ? Date.parse(b.grant.updated_at) : 0;
        const dateA = a.grant.updated_at ? Date.parse(a.grant.updated_at) : 0;
        if (dateB !== dateA) {
          return dateB - dateA;
        }
        return b.score - a.score;
      });
      return sorted;
    }

    if (sortKey === 'deadline') {
      sorted.sort((a, b) => {
        const validity = validityComparator(a, b);
        if (validity !== 0) {
          return validity;
        }
        const dateA = a.grant.deadline ? Date.parse(a.grant.deadline) : Number.POSITIVE_INFINITY;
        const dateB = b.grant.deadline ? Date.parse(b.grant.deadline) : Number.POSITIVE_INFINITY;
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        return b.score - a.score;
      });
      return sorted;
    }

    if (sortKey === 'amount_max') {
      sorted.sort((a, b) => {
        const validity = validityComparator(a, b);
        if (validity !== 0) {
          return validity;
        }
        const amountB = b.grant.amount?.max ?? 0;
        const amountA = a.grant.amount?.max ?? 0;
        if (amountB !== amountA) {
          return amountB - amountA;
        }
        return b.score - a.score;
      });
      return sorted;
    }

    return sorted;
  }

  function renderResults(results, tokens) {
    if (!elements.resultsList) {
      return;
    }
    elements.resultsList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    results.forEach(({ grant, score, matchedTokens }) => {
      const expired = grantExpired(grant);
      const article = document.createElement('article');
      article.className = 'card result-card';
      article.setAttribute('role', 'article');
      article.dataset.id = grant.id;
      if (expired) {
        article.classList.add('is-expired');
        article.setAttribute('data-expired', 'true');
      }

      const header = document.createElement('header');
      const title = document.createElement('h3');
      const titleLink = document.createElement('a');
      titleLink.href = grant.link;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.innerHTML = highlightText(grant.title, matchedTokens.length ? matchedTokens : tokens);
      titleLink.className = 'result-title-link';
      titleLink.setAttribute('data-score', score.toFixed(2));
      title.appendChild(titleLink);
      header.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'result-meta';
      meta.innerHTML = [
        wrapPill(grant.source),
        wrapPill(capitalize(grant.level)),
        wrapPill(grant.region),
        wrapPill(formatDeadline(grant.deadline))
      ].join('');

      const amountLine = document.createElement('p');
      amountLine.className = 'meta';
      amountLine.textContent = formatAmount(grant.amount);

      const tags = document.createElement('div');
      tags.className = 'result-tags';
      if (Array.isArray(grant.tags)) {
        grant.tags.forEach((tag) => {
          const span = document.createElement('span');
          span.className = 'badge';
          span.textContent = tag;
          tags.appendChild(span);
        });
      }

      const eligibility = document.createElement('p');
      eligibility.className = 'result-eligibility';
      const snippet = createSnippet(grant.eligibility || '', tokens);
      eligibility.innerHTML = highlightText(snippet, matchedTokens.length ? matchedTokens : tokens);

      const actions = document.createElement('div');
      actions.className = 'result-actions';

      const openLink = document.createElement('a');
      openLink.className = 'btn primary';
      openLink.textContent = 'Ouvrir';
      openLink.href = grant.link;
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';

      const copyButton = document.createElement('button');
      copyButton.className = 'btn';
      copyButton.type = 'button';
      copyButton.dataset.action = 'copy-link';
      copyButton.dataset.link = grant.link;
      copyButton.textContent = 'Copier le lien';

      const favoriteButton = document.createElement('button');
      favoriteButton.className = 'btn link';
      favoriteButton.type = 'button';
      favoriteButton.dataset.action = 'toggle-favorite';
      favoriteButton.dataset.id = grant.id;
      const isFavorite = favorites.has(grant.id);
      favoriteButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      favoriteButton.textContent = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';

      actions.appendChild(openLink);
      actions.appendChild(copyButton);
      actions.appendChild(favoriteButton);

      article.appendChild(header);
      article.appendChild(meta);
      article.appendChild(amountLine);
      if (expired) {
        const status = document.createElement('span');
        status.className = 'badge badge-expired';
        status.textContent = 'Expirée';
        article.appendChild(status);
      }
      article.appendChild(eligibility);
      article.appendChild(tags);
      article.appendChild(actions);

      fragment.appendChild(article);
    });

    elements.resultsList.appendChild(fragment);
  }

  function wrapPill(text) {
    if (!text) {
      return '';
    }
    return `<span class="pill">${escapeHTML(text)}</span>`;
  }

  function renderFilterGroups(tokens) {
    renderFilterButtons('regions', filterOptions.regions, tokens);
    renderFilterButtons('sectors', filterOptions.sectors, tokens);
    renderFilterButtons('audiences', filterOptions.audiences, tokens);
    renderFilterButtons('tags', filterOptions.tags, tokens);
    renderFilterButtons('naf', filterOptions.naf, tokens);
    renderFilterButtons('types', filterOptions.types, tokens, { transform: formatTypeLabel });
    renderFilterButtons('level', filterOptions.level, tokens, { type: 'single', transform: capitalize });
  }

  function renderFilterButtons(key, options, tokens, config = {}) {
    const container = filterContainers[key];
    if (!container) {
      return;
    }
    const counts = computeFilterCounts(key, tokens);
    const isSingle = config.type === 'single';
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.filterKey = key;
      button.dataset.value = option;
      button.dataset.filterType = isSingle ? 'single' : 'multi';
      button.setAttribute('aria-pressed', isSingle ? (state.level === option ? 'true' : 'false') : (state[key].has(option) ? 'true' : 'false'));
      if (!isSingle && state[key].has(option)) {
        button.classList.add('is-active');
      }
      if (isSingle && state.level === option) {
        button.classList.add('is-active');
      }
      const label = config.transform ? config.transform(option) : option;
      const count = counts.get(option) || 0;
      button.innerHTML = `${escapeHTML(label)} <span class="meta">(${count})</span>`;
      fragment.appendChild(button);
    });
    container.appendChild(fragment);
  }

  function computeFilterCounts(key, tokens) {
    const clone = cloneState(state);
    if (key === 'level') {
      clone.level = '';
    } else if (clone[key] instanceof Set) {
      clone[key].clear();
    }
    const filtered = applyFilters(grants, clone);
    const matches = computeSearch(filtered, tokens);
    const counter = new Map();

    matches.forEach(({ grant }) => {
      let values = [];
      switch (key) {
        case 'regions':
          values = grant.region ? [grant.region] : [];
          break;
        case 'level':
          values = grant.level ? [grant.level] : [];
          break;
        case 'sectors':
          values = Array.isArray(grant.sectors) ? grant.sectors : [];
          break;
        case 'audiences':
          values = Array.isArray(grant.audience) ? grant.audience : [];
          break;
        case 'tags':
          values = Array.isArray(grant.tags) ? grant.tags : [];
          break;
        case 'naf':
          values = Array.isArray(grant.naf) ? grant.naf : [];
          break;
        case 'types':
          values = grant.amount?.type ? [grant.amount.type] : [];
          break;
        default:
          values = [];
      }
      values.forEach((value) => {
        counter.set(value, (counter.get(value) || 0) + 1);
      });
    });
    return counter;
  }

  function renderPagination(totalPages, totalResults) {
    if (!elements.pagination) {
      return;
    }
    elements.pagination.innerHTML = '';
    if (totalResults === 0) {
      return;
    }
    const fragment = document.createDocumentFragment();

    const createPageButton = (page, label, isCurrent = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.className = 'page-button';
      button.dataset.page = String(page);
      if (isCurrent) {
        button.setAttribute('aria-current', 'page');
      }
      return button;
    };

    const addIfValid = (page, label) => {
      if (page >= 1 && page <= totalPages) {
        fragment.appendChild(createPageButton(page, label));
      }
    };

    addIfValid(state.page - 1, 'Précédent');

    for (let page = 1; page <= totalPages; page += 1) {
      const button = createPageButton(page, String(page), page === state.page);
      fragment.appendChild(button);
    }

    addIfValid(state.page + 1, 'Suivant');

    elements.pagination.appendChild(fragment);
  }

  function renderActiveFilters(tokens) {
    if (!elements.activeFilters) {
      return;
    }
    elements.activeFilters.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const addChip = (label, clearFn) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip is-active';
      button.textContent = label;
      button.addEventListener('click', () => {
        clearFn();
        state.page = 1;
        refresh();
      });
      fragment.appendChild(button);
    };

    state.regions.forEach((value) => addChip(`Région · ${value}`, () => state.regions.delete(value)));
    if (state.level) {
      addChip(`Niveau · ${capitalize(state.level)}`, () => {
        state.level = '';
      });
    }
    state.sectors.forEach((value) => addChip(`Secteur · ${value}`, () => state.sectors.delete(value)));
    state.audiences.forEach((value) => addChip(`Public · ${value}`, () => state.audiences.delete(value)));
    state.tags.forEach((value) => addChip(`Tag · ${value}`, () => state.tags.delete(value)));
    state.types.forEach((value) => addChip(`Type · ${formatTypeLabel(value)}`, () => state.types.delete(value)));
    state.naf.forEach((value) => addChip(`NAF · ${value}`, () => state.naf.delete(value)));

    if (state.amountMin !== null) {
      addChip(`Montant ≥ ${formatNumber(state.amountMin)} €`, () => {
        state.amountMin = null;
        rangeInputs.amountMin.value = '';
      });
    }
    if (state.amountMax !== null) {
      addChip(`Montant ≤ ${formatNumber(state.amountMax)} €`, () => {
        state.amountMax = null;
        rangeInputs.amountMax.value = '';
      });
    }
    if (state.deadlineAfter) {
      addChip(`Après ${formatDate(state.deadlineAfter)}`, () => {
        state.deadlineAfter = '';
        rangeInputs.deadlineAfter.value = '';
      });
    }
    if (state.deadlineBefore) {
      addChip(`Avant ${formatDate(state.deadlineBefore)}`, () => {
        state.deadlineBefore = '';
        rangeInputs.deadlineBefore.value = '';
      });
    }

    if (!fragment.childNodes.length && state.query) {
      const info = document.createElement('span');
      info.className = 'meta';
      info.textContent = `Filtre texte : “${state.query}”`;
      elements.activeFilters.appendChild(info);
      return;
    }

    elements.activeFilters.appendChild(fragment);
  }

  function updateResultsCount(total, pages) {
    const countText = total === 0 ? 'Aucun résultat' : `${total} résultat${total > 1 ? 's' : ''}`;
    elements.resultsCount.textContent = `${countText} — page ${state.page}/${pages}`;
  }

  function updateEmptyState(total) {
    if (total === 0) {
      elements.emptyState.hidden = false;
      return;
    }
    elements.emptyState.hidden = true;
  }

  function renderFavorites() {
    if (!elements.favoritesList || !elements.favoritesCount) {
      return;
    }
    elements.favoritesList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const favoriteGrants = Array.from(favorites)
      .map((id) => grantMap.get(id))
      .filter(Boolean);

    favoriteGrants.forEach((grant) => {
      const item = document.createElement('div');
      item.className = 'favorite-item';
      const link = document.createElement('a');
      link.href = grant.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = grant.title;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn link';
      removeButton.dataset.action = 'remove-favorite';
      removeButton.dataset.id = grant.id;
      removeButton.textContent = 'Retirer';

      item.appendChild(link);
      item.appendChild(removeButton);
      fragment.appendChild(item);
    });

    elements.favoritesList.appendChild(fragment);
    const total = favorites.size;
    elements.favoritesCount.textContent = total
      ? `${total} favori${total > 1 ? 's' : ''} sauvegardé${total > 1 ? 's' : ''}`
      : 'Aucun favori enregistré';
    elements.clearFavorites.disabled = total === 0;
  }

  function syncInputsFromState() {
    if (elements.searchInput) {
      elements.searchInput.value = state.query;
    }
    if (elements.sortSelect) {
      elements.sortSelect.value = state.sort;
    }
    if (elements.pageSizeSelect) {
      elements.pageSizeSelect.value = String(state.pageSize);
    }
    if (rangeInputs.amountMin) {
      rangeInputs.amountMin.value = state.amountMin ?? '';
    }
    if (rangeInputs.amountMax) {
      rangeInputs.amountMax.value = state.amountMax ?? '';
    }
    if (rangeInputs.deadlineAfter) {
      rangeInputs.deadlineAfter.value = state.deadlineAfter;
    }
    if (rangeInputs.deadlineBefore) {
      rangeInputs.deadlineBefore.value = state.deadlineBefore;
    }
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.query) {
      params.set('q', state.query);
    }
    const appendSet = (key, set) => {
      Array.from(set).forEach((value) => {
        params.append(`${key}[]`, value);
      });
    };
    appendSet('regions', state.regions);
    appendSet('sectors', state.sectors);
    appendSet('audiences', state.audiences);
    appendSet('tags', state.tags);
    appendSet('naf', state.naf);
    appendSet('types', state.types);

    if (state.level) {
      params.set('level', state.level);
    }
    if (state.amountMin !== null) {
      params.set('amountMin', String(state.amountMin));
    }
    if (state.amountMax !== null) {
      params.set('amountMax', String(state.amountMax));
    }
    if (state.deadlineAfter) {
      params.set('deadlineAfter', state.deadlineAfter);
    }
    if (state.deadlineBefore) {
      params.set('deadlineBefore', state.deadlineBefore);
    }
    if (state.sort && state.sort !== 'relevance') {
      params.set('sort', state.sort);
    }
    if (state.page && state.page !== 1) {
      params.set('page', String(state.page));
    }
    if (state.pageSize && state.pageSize !== 10) {
      params.set('pageSize', String(state.pageSize));
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }

  function renderQuickFilters() {
    if (!elements.quickFilters) {
      return;
    }
    const fragment = document.createDocumentFragment();
    quickFilters.forEach((filter, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.quick = String(index);
      button.setAttribute('role', 'listitem');
      button.textContent = filter.label;
      fragment.appendChild(button);
    });
    elements.quickFilters.innerHTML = '';
    elements.quickFilters.appendChild(fragment);
  }

  function announce(message) {
    if (!elements.announcer) {
      return;
    }
    elements.announcer.textContent = '';
    requestAnimationFrame(() => {
      elements.announcer.textContent = message;
    });
  }

  function tokenize(input) {
    if (!input || typeof input !== 'string') {
      return [];
    }
    const normalized = normalizeText(input);
    const tokens = normalized
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOPWORDS.has(token));
    return Array.from(new Set(tokens));
  }

  function normalizeText(text) {
    return text
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  function escapeHTML(value) {
    return value
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightText(text, tokens) {
    if (!tokens.length || !text) {
      return escapeHTML(text);
    }
    const { normalized, map } = buildNormalizedMap(text);
    const ranges = [];

    tokens.forEach((token) => {
      let index = normalized.indexOf(token);
      while (index !== -1) {
        const start = map[index];
        const end = map[Math.min(index + token.length - 1, map.length - 1)] + 1;
        ranges.push([start, end]);
        index = normalized.indexOf(token, index + token.length);
      }
    });

    if (!ranges.length) {
      return escapeHTML(text);
    }

    const merged = mergeRanges(ranges);
    let result = '';
    let lastIndex = 0;
    merged.forEach(([start, end]) => {
      result += escapeHTML(text.slice(lastIndex, start));
      result += `<mark class="highlight">${escapeHTML(text.slice(start, end))}</mark>`;
      lastIndex = end;
    });
    result += escapeHTML(text.slice(lastIndex));
    return result;
  }

  function buildNormalizedMap(text) {
    const map = [];
    let normalized = '';
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const normalizedChar = char
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
      normalized += normalizedChar;
      for (let j = 0; j < normalizedChar.length; j += 1) {
        map.push(i);
      }
    }
    return { normalized, map };
  }

  function mergeRanges(ranges) {
    if (!ranges.length) {
      return [];
    }
    const sorted = ranges.sort((a, b) => a[0] - b[0]);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i += 1) {
      const last = merged[merged.length - 1];
      const current = sorted[i];
      if (current[0] <= last[1]) {
        last[1] = Math.max(last[1], current[1]);
      } else {
        merged.push(current);
      }
    }
    return merged;
  }

  function createSnippet(text, tokens, length = 200) {
    if (!text) {
      return '';
    }
    const sanitized = text.trim();
    if (!tokens.length || sanitized.length <= length) {
      return sanitized.length > length ? `${sanitized.slice(0, length)}…` : sanitized;
    }

    const { normalized, map } = buildNormalizedMap(sanitized);
    let firstMatchIndex = -1;
    tokens.forEach((token) => {
      const index = normalized.indexOf(token);
      if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
        firstMatchIndex = index;
      }
    });

    if (firstMatchIndex === -1) {
      return sanitized.length > length ? `${sanitized.slice(0, length)}…` : sanitized;
    }

    const start = Math.max(0, map[firstMatchIndex] - 60);
    const snippet = sanitized.slice(start, start + length);
    return start > 0 ? `… ${snippet.trim()}` : snippet.trim();
  }

  function formatAmount(amount) {
    if (!amount) {
      return 'Montant : voir conditions';
    }
    const typeLabel = formatTypeLabel(amount.type);
    const hasMin = typeof amount.min === 'number';
    const hasMax = typeof amount.max === 'number';
    const min = hasMin ? `${formatNumber(amount.min)} €` : null;
    const max = hasMax ? `${formatNumber(amount.max)} €` : null;
    let range = 'Voir conditions';
    if (hasMin && hasMax) {
      range = amount.min === amount.max ? `${min}` : `${min} – ${max}`;
    } else if (hasMin) {
      range = `${min}`;
    } else if (hasMax) {
      range = `${max}`;
    }
    const rate = typeof amount.rate === 'number' ? ` · Taux ${Math.round(amount.rate * 100)}%` : '';
    const notes = amount.notes ? ` · ${amount.notes}` : '';
    return `${typeLabel} : ${range}${rate}${notes ? notes : ''}`;
  }

  function formatTypeLabel(type) {
    if (!type) {
      return 'Aide';
    }
    switch (type) {
      case 'subvention':
        return 'Subvention';
      case 'avance':
        return 'Avance';
      case 'prêt':
        return 'Prêt';
      default:
        return capitalize(type);
    }
  }

  function formatDeadline(deadline) {
    if (!deadline) {
      return 'Délais variables';
    }
    return `Clôture ${formatDate(deadline)}`;
  }

  function formatDate(dateString) {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  function capitalize(text) {
    if (!text) {
      return '';
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        fn(...args);
      }, delay);
    };
  }

  async function copyToClipboard(text) {
    if (!text) {
      return false;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('Clipboard API indisponible', error);
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (error) {
      console.error('Fallback copy échoué', error);
      return false;
    }
  }

  function grantExpired(grant) {
    if (!grant || !grant.deadline) {
      return false;
    }
    const time = Date.parse(grant.deadline);
    if (Number.isNaN(time)) {
      return false;
    }
    return time < Date.now();
  }
})();
