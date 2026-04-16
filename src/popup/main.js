let state = { sites: [], usage: {}, dateKey: '' };
let refreshTimer = null;
let lastSiteKey = '';
let expandedDomain = null;

/***************
 * Data
 ***************/

async function fetchStatus() {
  state = await browser.runtime.sendMessage({ type: 'getStatus' });
  render();
}

/***************
 * Render
 ***************/

function render() {
  const list = qs('#site-list');
  const empty = qs('#empty-state');

  if (state.sites.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    qs('#total-time').textContent = '0m today';
    lastSiteKey = '';
    expandedDomain = null;
    return;
  }

  empty.classList.add('hidden');

  // Only rebuild DOM when site list structure changes
  const siteKey = state.sites.map(s => s.domain + ':' + s.daily_limit_minutes).join(',');
  if (siteKey !== lastSiteKey) {
    lastSiteKey = siteKey;
    buildCards(list);
  }

  // Update dynamic values without touching innerHTML
  let totalSeconds = 0;
  for (const site of state.sites) {
    const sec = state.usage[site.domain] || 0;
    totalSeconds += sec;
    const limitSec = site.daily_limit_minutes * 60;
    const pct = Math.min(100, (sec / limitSec) * 100);
    const min = Math.floor(sec / 60);
    const color = statusColor(pct);

    const card = qs(`[data-site="${site.domain}"]`, list);
    if (!card) continue;

    card.style.borderLeftColor = color;
    qs('.progress-fill', card).style.width = pct + '%';
    qs('.progress-fill', card).style.background = color;
    qs('.site-time', card).textContent = min + ' / ' + site.daily_limit_minutes + ' min';
  }

  const totalMin = Math.floor(totalSeconds / 60);
  qs('#total-time').textContent = totalMin + 'm today';
}

function buildCards(list) {
  let html = '';
  for (const site of state.sites) {
    const isExpanded = expandedDomain === site.domain;
    html += `
      <div class="site-card${isExpanded ? ' expanded' : ''}" data-site="${esc(site.domain)}">
        <div class="site-header">
          <span class="site-domain">${esc(site.domain)}</span>
          <span class="site-time"></span>
        </div>
        <div class="progress-track">
          <div class="progress-fill"></div>
        </div>
        <div class="site-actions">
          <label class="limit-edit">
            Limit:
            <input type="number" class="limit-input" data-domain="${esc(site.domain)}"
                   value="${site.daily_limit_minutes}" min="0" max="1440">
            min/day
          </label>
          <button class="btn-remove" data-domain="${esc(site.domain)}">Remove</button>
        </div>
      </div>`;
  }
  list.innerHTML = html;

  for (const card of qsa('.site-card', list)) {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.site-actions')) return;
      toggleCard(card.dataset.site, list);
    });
  }
  for (const btn of qsa('.btn-remove', list)) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSite(btn.dataset.domain);
    });
  }
  for (const input of qsa('.limit-input', list)) {
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', () =>
      updateLimit(input.dataset.domain, parseInt(input.value, 10))
    );
  }
}

function toggleCard(domain, list) {
  const wasExpanded = expandedDomain === domain;

  for (const card of qsa('.site-card', list)) {
    card.classList.remove('expanded');
  }

  if (!wasExpanded) {
    const card = qs(`[data-site="${domain}"]`, list);
    card.classList.add('expanded');
    expandedDomain = domain;
  } else {
    expandedDomain = null;
  }
}

/***************
 * Actions
 ***************/

async function addSite(raw, limit) {
  const domain = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');

  if (!domain || !domain.includes('.')) return;
  if (state.sites.some((s) => s.domain === domain)) return;

  state.sites.push({ domain, daily_limit_minutes: limit });
  await browser.storage.local.set({ sites: state.sites });
  lastSiteKey = '';
  render();
}

async function removeSite(domain) {
  if (expandedDomain === domain) expandedDomain = null;
  state.sites = state.sites.filter((s) => s.domain !== domain);
  await browser.storage.local.set({ sites: state.sites });
  lastSiteKey = '';
  render();
}

async function updateLimit(domain, minutes) {
  if (isNaN(minutes) || minutes < 0) return;
  const site = state.sites.find((s) => s.domain === domain);
  if (!site) return;
  site.daily_limit_minutes = minutes;
  await browser.storage.local.set({ sites: state.sites });
}

/***************
 * Init
 ***************/

fetchStatus();
refreshTimer = setInterval(fetchStatus, 1000);

qs('#toggle-add').addEventListener('click', () => {
  qs('#add-form').classList.toggle('hidden');
});

qs('#add-btn').addEventListener('click', () => {
  const domain = qs('#domain-input').value;
  const limit = parseInt(qs('#limit-input').value, 10) || 30;
  addSite(domain, limit);
  qs('#domain-input').value = '';
});

qs('#domain-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') qs('#add-btn').click();
});

window.addEventListener('unload', () => {
  if (refreshTimer) clearInterval(refreshTimer);
});
