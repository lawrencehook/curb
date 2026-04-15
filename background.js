(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────
  let sites = [];
  let usage = {};           // { domain: seconds } for today
  let dateKey = getDateKey();
  let activeTabId = null;
  let trackedDomain = null;
  let ticker = null;
  let dirty = false;

  // ── Utilities ──────────────────────────────────────────────
  function getDateKey() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function hostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  function findSite(host) {
    if (!host) return null;
    for (const s of sites) {
      if (host === s.domain || host.endsWith("." + s.domain)) return s;
    }
    return null;
  }

  function badgeText(sec) {
    if (sec < 60) return sec + "s";
    const m = Math.floor(sec / 60);
    return m < 100 ? m + "m" : Math.floor(m / 60) + "h";
  }

  function badgeColor(sec, limitSec) {
    const r = sec / limitSec;
    if (r >= 0.95) return "#dc2626";
    if (r >= 0.8) return "#ea580c";
    if (r >= 0.5) return "#ca8a04";
    return "#16a34a";
  }

  // ── Storage ────────────────────────────────────────────────
  async function load() {
    const data = await browser.storage.local.get(["sites", "usage"]);
    sites = data.sites || [
      { domain: "twitter.com", dailyLimitMinutes: 30 },
      { domain: "x.com", dailyLimitMinutes: 30 },
    ];
    const allUsage = data.usage || {};

    // Prune entries older than 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const k of Object.keys(allUsage)) {
      if (k < cutoffStr) delete allUsage[k];
    }

    usage = allUsage[dateKey] || {};
    if (!data.sites) await browser.storage.local.set({ sites });
  }

  async function flush() {
    if (!dirty) return;
    const { usage: allUsage = {} } = await browser.storage.local.get("usage");
    allUsage[dateKey] = usage;
    await browser.storage.local.set({ usage: allUsage });
    dirty = false;
  }

  // ── Extensions (bonus time) ────────────────────────────────
  async function getExtensionCount(domain) {
    const key = `ext_${dateKey}_${domain}`;
    const data = await browser.storage.local.get(key);
    return data[key] || 0;
  }

  async function effectiveLimit(site) {
    const ext = await getExtensionCount(site.domain);
    return site.dailyLimitMinutes * 60 + ext * 300;
  }

  // ── Tracking ───────────────────────────────────────────────
  function tick() {
    if (!trackedDomain) return;

    // Day rollover
    const now = getDateKey();
    if (now !== dateKey) {
      dateKey = now;
      usage = {};
    }

    usage[trackedDomain] = (usage[trackedDomain] || 0) + 1;
    dirty = true;

    const sec = usage[trackedDomain];
    const site = findSite(trackedDomain);
    if (!site) return;

    browser.browserAction.setBadgeText({ text: badgeText(sec) });
    browser.browserAction.setBadgeBackgroundColor({
      color: badgeColor(sec, site.dailyLimitMinutes * 60),
    });

    // Check limit (async)
    effectiveLimit(site).then((limit) => {
      if (sec >= limit && trackedDomain === site.domain) {
        blockTab(trackedDomain, sec, limit);
      }
    });
  }

  function startTracking(domain) {
    if (trackedDomain === domain) return;
    stopTracking();
    trackedDomain = domain;

    const sec = usage[domain] || 0;
    const site = findSite(domain);
    if (site) {
      browser.browserAction.setBadgeText({ text: badgeText(sec) });
      browser.browserAction.setBadgeBackgroundColor({
        color: badgeColor(sec, site.dailyLimitMinutes * 60),
      });
    }

    ticker = setInterval(tick, 1000);
  }

  function stopTracking() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    trackedDomain = null;
    browser.browserAction.setBadgeText({ text: "" });
    flush();
  }

  // ── Blocking ───────────────────────────────────────────────
  function blockTab(domain, spent, limit) {
    const tabId = activeTabId;
    stopTracking();
    const p = new URLSearchParams({
      domain,
      spent: String(spent),
      limit: String(limit),
    });
    browser.tabs.update(tabId, {
      url: browser.runtime.getURL("blocked/blocked.html?" + p),
    });
  }

  // ── Tab evaluation ─────────────────────────────────────────
  async function evaluate(tabId) {
    activeTabId = tabId;
    try {
      const tab = await browser.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith(browser.runtime.getURL(""))) {
        stopTracking();
        return;
      }

      const host = hostname(tab.url);
      const site = findSite(host);
      if (!site) {
        stopTracking();
        return;
      }

      const sec = usage[site.domain] || 0;
      const limit = await effectiveLimit(site);
      if (sec >= limit) {
        blockTab(site.domain, sec, limit);
        return;
      }

      startTracking(site.domain);
    } catch {
      stopTracking();
    }
  }

  // ── Event listeners ────────────────────────────────────────
  browser.tabs.onActivated.addListener(({ tabId }) => evaluate(tabId));

  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (tabId === activeTabId && info.url) evaluate(tabId);
  });

  browser.windows.onFocusChanged.addListener((wid) => {
    if (wid === browser.windows.WINDOW_ID_NONE) {
      stopTracking();
      return;
    }
    browser.tabs.query({ active: true, windowId: wid }).then((tabs) => {
      if (tabs[0]) evaluate(tabs[0].id);
    });
  });

  browser.storage.onChanged.addListener((changes) => {
    if (changes.sites) {
      sites = changes.sites.newValue || [];
      if (activeTabId) evaluate(activeTabId);
    }
  });

  // Periodic flush every 10 seconds
  setInterval(flush, 10000);

  // ── Message handling ───────────────────────────────────────
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "getStatus") {
      sendResponse({ sites, usage, dateKey });
      return false;
    }

    if (msg.type === "extendTime") {
      const site = findSite(msg.domain);
      if (!site) {
        sendResponse({ success: false });
        return false;
      }
      const key = `ext_${dateKey}_${msg.domain}`;
      browser.storage.local.get(key).then((data) => {
        const count = data[key] || 0;
        if (count >= 3) {
          sendResponse({ success: false, remaining: 0 });
          return;
        }
        browser.storage.local.set({ [key]: count + 1 }).then(() => {
          sendResponse({ success: true, remaining: 2 - count });
        });
      });
      return true; // async response
    }
  });

  // ── Init ───────────────────────────────────────────────────
  load().then(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) evaluate(tabs[0].id);
    });
  });
})();
