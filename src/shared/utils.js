// Browser API compatibility
if (typeof browser === 'undefined') {
  browser = typeof chrome !== 'undefined' ? chrome : null;
}

function qs(query, root = document) {
  return root.querySelector(query);
}

function qsa(query, root = document) {
  return Array.from(root.querySelectorAll(query));
}

function esc(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}

function statusColor(pct) {
  if (pct >= 95) return '#b5636a';
  if (pct >= 80) return '#c4856b';
  if (pct >= 50) return '#c9a84e';
  return '#7a9e7e';
}
