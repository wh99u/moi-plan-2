import { useSyncExternalStore } from 'react';
import { getAccent, setAccent, subscribeAccent, type AccentId } from '../../app/accent';
import { imageIds, mergeStates, sameState } from '../../lib/merge';
import { getImageBlob, hasImage, putImageAs } from '../../lib/images';
import type { StateV4 } from '../../lib/types';
import { keyFrom, open, openText, seal, sealText } from './crypto';

/*
 * Synchronisation with no server of our own: the owner's GitHub account is the account, and one
 * secret gist in it holds the encrypted data. Every device merges record by record with that copy.
 */

const API = 'https://api.github.com';
const CONFIG_KEY = 'sync_v1';
const PREFS_AT = 'sync_prefs_at';
const DATA_FILE = 'moi-plan.json';
const PREFS_FILE = 'prefs.json';
const IMAGE_PREFIX = 'img-';
const DESCRIPTION = 'Мой план: данные между устройствами (зашифровано)';
/** How soon after a change it goes out, ms. */
const AFTER_CHANGE = 4000;
/** How often an open site looks for changes from other devices, ms. */
const EVERY = 60_000;
/** Pictures per round, so one round stays short on a slow connection. */
const IMAGES_PER_ROUND = 6;

interface Config {
  token: string;
  login: string;
  gistId: string;
}

export type SyncStatus =
  | { state: 'off' }
  | { state: 'busy'; login?: string; at?: number }
  | { state: 'ok'; login: string; at: number }
  | { state: 'error'; login?: string; at?: number; message: string };

export interface SyncHost {
  get: () => StateV4;
  replace: (s: StateV4) => void;
  subscribe: (fn: () => void) => () => void;
  /** After new data has arrived: what depends on the day, and pictures on screen. */
  afterMerge?: () => void;
}

interface Prefs {
  at: number;
  name?: string;
  picture?: string;
  accent?: AccentId;
}

export interface ProfileLink {
  read: () => { name: string; picture?: string };
  write: (p: { name?: string; picture?: string }) => void;
  subscribe: (fn: () => void) => () => void;
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface Gist {
  id: string;
  description?: string;
  files: Record<string, GistFile>;
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

function readConfig(): Config | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as Config) : null;
  } catch {
    return null;
  }
}

function writeConfig(c: Config | null) {
  try {
    if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* lasts for this visit */
  }
}

async function github<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new SyncError('Нет связи с GitHub');
  }
  if (res.status === 401) throw new SyncError('GitHub не принял токен. Проверь, что он скопирован целиком и не истёк', 401);
  if (res.status === 403 || res.status === 404) throw new SyncError('У токена нет доступа к gist. При создании нужно отметить галочку gist', res.status);
  if (!res.ok) throw new SyncError(`GitHub ответил ошибкой ${res.status}`, res.status);
  return (await res.json()) as T;
}

async function fileText(f: GistFile): Promise<string> {
  if (!f.truncated && f.content !== undefined) return f.content;
  if (!f.raw_url) throw new SyncError('Не удалось прочитать копию на GitHub');
  try {
    const res = await fetch(f.raw_url, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    return await res.text();
  } catch {
    throw new SyncError('Не удалось прочитать копию на GitHub');
  }
}

function fromCopy(json: string): StateV4 {
  const s = JSON.parse(json) as StateV4;
  if (!s || s.v !== 4 || !s.shared || !s.personal) throw new SyncError('Копия на GitHub повреждена');
  return s;
}

/** Ready to be tried with a stand-in for GitHub, and with a store other than the site's. */
export function createSync(host: SyncHost, profile?: ProfileLink) {
  let config = readConfig();
  let status: SyncStatus = config ? { state: 'busy', login: config.login } : { state: 'off' };
  let key: Promise<CryptoKey> | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  let applying = false;
  const listeners = new Set<() => void>();

  const setStatus = (next: SyncStatus) => {
    status = next;
    listeners.forEach((l) => l());
  };
  const keyNow = () => (key ??= keyFrom(config!.token));

  const prefsAt = () => {
    try {
      return Number(localStorage.getItem(PREFS_AT)) || 0;
    } catch {
      return 0;
    }
  };
  const markPrefs = (at: number) => {
    try {
      localStorage.setItem(PREFS_AT, String(at));
    } catch {
      /* the next change marks it again */
    }
  };
  const localPrefs = (): Prefs => ({ at: prefsAt(), ...(profile ? profile.read() : {}), accent: getAccent() });

  async function exchangePrefs(k: CryptoKey, gist: Gist, files: Record<string, { content: string }>) {
    const mine = localPrefs();
    const remote = gist.files[PREFS_FILE];
    const theirs = remote ? (JSON.parse(await openText(k, await fileText(remote))) as Prefs) : null;
    if (theirs && theirs.at > mine.at) {
      applying = true;
      if (theirs.accent) setAccent(theirs.accent);
      profile?.write({ name: theirs.name, picture: theirs.picture });
      applying = false;
      markPrefs(theirs.at);
    } else if (!theirs || mine.at > theirs.at) {
      files[PREFS_FILE] = { content: await sealText(k, JSON.stringify(mine)) };
    }
  }

  async function exchangeImages(k: CryptoKey, gist: Gist, files: Record<string, { content: string }>) {
    const wanted = imageIds(host.get());
    let budget = IMAGES_PER_ROUND;
    let arrived = false;
    for (const id of wanted) {
      if (!budget) break;
      const name = `${IMAGE_PREFIX}${id}`;
      const remote = gist.files[name];
      const here = await hasImage(id);
      if (here && !remote) {
        const blob = await getImageBlob(id);
        if (!blob) continue;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        files[name] = { content: JSON.stringify({ type: blob.type, body: await seal(k, bytes) }) };
        budget--;
      } else if (!here && remote) {
        const { type, body } = JSON.parse(await fileText(remote)) as { type: string; body: string };
        const bytes = await open(k, body);
        await putImageAs(id, new Blob([new Uint8Array(bytes)], { type }));
        arrived = true;
        budget--;
      }
    }
    return arrived;
  }

  async function round() {
    const c = config;
    if (!c) return;
    setStatus({ state: 'busy', login: c.login, at: status.state === 'ok' ? status.at : undefined });
    const k = await keyNow();
    const gist = await github<Gist>(c.token, `/gists/${c.gistId}`);
    const remote = gist.files[DATA_FILE];
    const files: Record<string, { content: string }> = {};

    const local = host.get();
    let merged = local;
    if (remote) {
      let theirs: StateV4;
      try {
        theirs = fromCopy(await openText(k, await fileText(remote)));
      } catch (e) {
        if (e instanceof SyncError) throw e;
        throw new SyncError('Копия на GitHub сделана с другим токеном. Отключи синхронизацию и подключи её тем же токеном, что на другом устройстве');
      }
      merged = mergeStates(local, theirs);
      if (!sameState(merged, local)) {
        // A change made while the copy was on its way is not overwritten: it goes into the merge too.
        applying = true;
        host.replace(mergeStates(host.get(), merged));
        host.afterMerge?.();
        applying = false;
        merged = host.get();
      }
      if (!sameState(merged, theirs)) files[DATA_FILE] = { content: await sealText(k, JSON.stringify(merged)) };
    } else {
      files[DATA_FILE] = { content: await sealText(k, JSON.stringify(merged)) };
    }

    await exchangePrefs(k, gist, files);
    const arrived = await exchangeImages(k, gist, files);
    if (arrived) host.afterMerge?.();

    if (Object.keys(files).length) await github(c.token, `/gists/${c.gistId}`, { method: 'PATCH', body: JSON.stringify({ files }) });
    setStatus({ state: 'ok', login: c.login, at: Date.now() });
  }

  /** One at a time: a request during a round runs right after it. */
  function syncNow(): Promise<void> {
    if (!config) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = round()
      .catch((e: unknown) => {
        const c = config;
        setStatus({ state: 'error', login: c?.login, message: e instanceof SyncError ? e.message : 'Не получилось синхронизировать' });
      })
      .finally(() => {
        running = null;
        if (again) {
          again = false;
          void syncNow();
        }
      });
    return running;
  }

  /** Takes the token: finds this account's copy, or makes one from what is on this device. */
  async function connect(rawToken: string): Promise<void> {
    const token = rawToken.trim();
    if (!token) throw new SyncError('Вставь токен');
    const user = await github<{ login: string; name?: string | null; avatar_url?: string }>(token, '/user');
    const list = await github<Gist[]>(token, '/gists?per_page=100');
    let gistId = list.find((g) => g.files && DATA_FILE in g.files)?.id;
    if (!gistId) {
      // A secret gist cannot be empty; the data follows in the first round.
      const made = await github<Gist>(token, '/gists', { method: 'POST', body: JSON.stringify({ description: DESCRIPTION, public: false, files: { 'readme.txt': { content: DESCRIPTION } } }) });
      gistId = made.id;
    }
    key = null;
    config = { token, login: user.login, gistId };
    writeConfig(config);
    // Who is signed in shows at once on the greeting and in the corner, if the name is not set yet.
    if (profile && !profile.read().name) profile.write({ name: user.name || user.login, picture: user.avatar_url });
    await syncNow();
    if ((status as SyncStatus).state === 'error') {
      const failed = status as Extract<SyncStatus, { state: 'error' }>;
      disconnect();
      throw new SyncError(failed.message);
    }
  }

  /** The data stays on this device and in the copy; only the link between them goes. */
  function disconnect() {
    config = null;
    key = null;
    writeConfig(null);
    setStatus({ state: 'off' });
  }

  function start() {
    const onChange = () => {
      if (applying || !config) return;
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => void syncNow(), AFTER_CHANGE);
    };
    const onPrefs = () => {
      if (applying) return;
      markPrefs(Date.now());
      onChange();
    };
    const onShow = () => {
      if (document.visibilityState === 'visible') void syncNow();
      // Going away with a change still waiting: send it now, the page may not come back.
      else if (changeTimer) {
        clearTimeout(changeTimer);
        changeTimer = null;
        void syncNow();
      }
    };
    const offStore = host.subscribe(onChange);
    const offAccent = subscribeAccent(onPrefs);
    const offProfile = profile?.subscribe(onPrefs);
    document.addEventListener('visibilitychange', onShow);
    addEventListener('online', onShow);
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow();
    }, EVERY);
    void syncNow();
    return () => {
      offStore();
      offAccent();
      offProfile?.();
      document.removeEventListener('visibilitychange', onShow);
      removeEventListener('online', onShow);
      clearInterval(tick);
      if (changeTimer) clearTimeout(changeTimer);
    };
  }

  return {
    connect,
    disconnect,
    syncNow,
    start,
    getStatus: () => status,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export type Sync = ReturnType<typeof createSync>;

export const useSyncStatus = (sync: Sync) => useSyncExternalStore(sync.subscribe, sync.getStatus);
