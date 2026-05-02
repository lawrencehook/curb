// Client-side helpers for the Curb sync server.
//
// Storage keys used:
//   sync_session: { token, email } | absent       — auth state
//   sync_version: integer                          — last successfully synced server version
//   sync_state:   { last_synced_at?, last_error? } — informational metadata

// Production sync server. For local development, swap to 'http://localhost:3000'.
// const SERVER_URL = 'http://localhost:3000';
const SERVER_URL = 'https://server.lawrencehook.com/curb';

/***************
 * Session
 ***************/

async function getSession() {
  const data = await browser.storage.local.get('sync_session');
  return data.sync_session || null;
}

async function setSession(session) {
  if (session) await browser.storage.local.set({ sync_session: session });
  else await browser.storage.local.remove('sync_session');
}

async function getSyncState() {
  const data = await browser.storage.local.get(['sync_version', 'sync_state']);
  return {
    version: data.sync_version || 0,
    lastSyncedAt: (data.sync_state && data.sync_state.last_synced_at) || null,
    lastError: (data.sync_state && data.sync_state.last_error) || null,
  };
}

async function setSyncState(patch) {
  const cur = (await browser.storage.local.get('sync_state')).sync_state || {};
  await browser.storage.local.set({ sync_state: { ...cur, ...patch } });
}

/***************
 * Auth
 ***************/

async function requestCode(email) {
  const r = await fetch(`${SERVER_URL}/auth/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body;
}

async function verifyCode(email, code) {
  const r = await fetch(`${SERVER_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  await setSession({ token: body.session_token, email: body.email });
  return body;
}

async function signOut() {
  await setSession(null);
  await browser.storage.local.remove(['sync_version', 'sync_state']);
}

/***************
 * Sync
 ***************/

async function authedFetch(path, opts = {}) {
  const session = await getSession();
  if (!session) throw new Error('Not signed in.');
  const r = await fetch(SERVER_URL + path, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${session.token}`,
    },
  });
  if (r.status === 401) {
    await setSession(null);
    throw new Error('Session expired — please sign in again.');
  }
  return r;
}

async function getRemote() {
  const r = await authedFetch('/sync');
  if (!r.ok) throw new Error(`Sync GET failed (${r.status})`);
  return r.json();
}

async function putRemote(policies, version) {
  const r = await authedFetch('/sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policies, version }),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 409) return { conflict: true, current: body.current };
  if (!r.ok) throw new Error(body.error || `Sync PUT failed (${r.status})`);
  return body;
}

// Pull, then push if local differs. On race conditions (PUT 409), take server.
// Returns { status: 'pulled' | 'pushed' | 'noop' | 'conflict', version }.
async function syncNow() {
  const localData = await browser.storage.local.get(['policies', 'sync_version']);
  const local = localData.policies || [];
  const localVersion = localData.sync_version || 0;

  let remote;
  try {
    remote = await getRemote();
  } catch (err) {
    await setSyncState({ last_error: err.message });
    throw err;
  }

  // Server is ahead of what we last synced — pull and replace local.
  if (remote.version > localVersion) {
    await browser.storage.local.set({
      policies: remote.policies,
      sync_version: remote.version,
    });
    await setSyncState({ last_synced_at: Date.now(), last_error: null });
    return { status: 'pulled', version: remote.version };
  }

  // Same version. If contents already match, nothing to do.
  if (JSON.stringify(local) === JSON.stringify(remote.policies)) {
    await browser.storage.local.set({ sync_version: remote.version });
    await setSyncState({ last_synced_at: Date.now(), last_error: null });
    return { status: 'noop', version: remote.version };
  }

  // Push local up.
  let put;
  try {
    put = await putRemote(local, remote.version);
  } catch (err) {
    await setSyncState({ last_error: err.message });
    throw err;
  }

  if (put.conflict) {
    // Another device pushed between our GET and PUT. Take server.
    await browser.storage.local.set({
      policies: put.current.policies,
      sync_version: put.current.version,
    });
    await setSyncState({
      last_synced_at: Date.now(),
      last_error: 'Remote changed during sync — pulled latest.',
    });
    return { status: 'conflict', version: put.current.version };
  }

  await browser.storage.local.set({ sync_version: put.version });
  await setSyncState({ last_synced_at: Date.now(), last_error: null });
  return { status: 'pushed', version: put.version };
}
