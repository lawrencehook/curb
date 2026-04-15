(function () {
  "use strict";

  let state = { sites: [], usage: {}, dateKey: "" };
  let refreshTimer = null;

  // ── Data ───────────────────────────────────────────────────
  async function fetchStatus() {
    state = await browser.runtime.sendMessage({ type: "getStatus" });
    render();
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    const list = document.getElementById("site-list");
    const empty = document.getElementById("empty-state");

    if (state.sites.length === 0) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      document.getElementById("total-time").textContent = "0m";
      return;
    }

    empty.classList.add("hidden");
    let totalSeconds = 0;
    let html = "";

    for (const site of state.sites) {
      const sec = state.usage[site.domain] || 0;
      totalSeconds += sec;
      const limitSec = site.dailyLimitMinutes * 60;
      const pct = Math.min(100, (sec / limitSec) * 100);
      const min = Math.floor(sec / 60);

      let color;
      if (pct >= 95) color = "#dc2626";
      else if (pct >= 80) color = "#ea580c";
      else if (pct >= 50) color = "#ca8a04";
      else color = "#16a34a";

      html += `
        <div class="site-card">
          <div class="site-header">
            <span class="site-domain">${esc(site.domain)}</span>
            <button class="btn-remove" data-domain="${esc(site.domain)}" title="Remove">&#x2715;</button>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="site-footer">
            <span>${min} / ${site.dailyLimitMinutes} min</span>
            <label class="limit-edit">
              Limit:
              <input type="number" class="limit-input" data-domain="${esc(site.domain)}"
                     value="${site.dailyLimitMinutes}" min="1" max="1440">
              min
            </label>
          </div>
        </div>`;
    }

    list.innerHTML = html;

    // Total
    const totalMin = Math.floor(totalSeconds / 60);
    document.getElementById("total-time").textContent = totalMin + "m";

    // Bind events
    for (const btn of list.querySelectorAll(".btn-remove")) {
      btn.addEventListener("click", () => removeSite(btn.dataset.domain));
    }
    for (const input of list.querySelectorAll(".limit-input")) {
      input.addEventListener("change", () =>
        updateLimit(input.dataset.domain, parseInt(input.value, 10))
      );
    }
  }

  function esc(s) {
    const el = document.createElement("span");
    el.textContent = s;
    return el.innerHTML;
  }

  // ── Actions ────────────────────────────────────────────────
  async function addSite(raw, limit) {
    const domain = raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");

    if (!domain || !domain.includes(".")) return;
    if (state.sites.some((s) => s.domain === domain)) return;

    state.sites.push({ domain, dailyLimitMinutes: limit });
    await browser.storage.local.set({ sites: state.sites });
    render();
  }

  async function removeSite(domain) {
    state.sites = state.sites.filter((s) => s.domain !== domain);
    await browser.storage.local.set({ sites: state.sites });
    render();
  }

  async function updateLimit(domain, minutes) {
    if (isNaN(minutes) || minutes < 1) return;
    const site = state.sites.find((s) => s.domain === domain);
    if (!site) return;
    site.dailyLimitMinutes = minutes;
    await browser.storage.local.set({ sites: state.sites });
  }

  // ── Init ───────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    fetchStatus();
    refreshTimer = setInterval(fetchStatus, 1000);

    document.getElementById("toggle-add").addEventListener("click", () => {
      document.getElementById("add-form").classList.toggle("hidden");
    });

    document.getElementById("add-btn").addEventListener("click", () => {
      const domain = document.getElementById("domain-input").value;
      const limit = parseInt(document.getElementById("limit-input").value, 10) || 30;
      addSite(domain, limit);
      document.getElementById("domain-input").value = "";
    });

    document.getElementById("domain-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("add-btn").click();
    });
  });

  window.addEventListener("unload", () => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
})();
