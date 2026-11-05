import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyState } from '../../lib/defaults';
import type { StateV4, Task } from '../../lib/types';
import { keyFrom, openText, sealText } from './crypto';
import { createSync } from './engine';

vi.mock('../../lib/images', () => ({
  getImageBlob: async () => null,
  hasImage: async () => true,
  putImageAs: async () => undefined,
}));

const TOKEN = 'test-token';
const task = (id: string, updatedAt: number, title = id) => ({ id, title, desc: '', due: '', done: false, updatedAt }) as Task;

/** A stand-in for GitHub: one account, its gists in memory. */
function fakeGithub(token = TOKEN) {
  const gists = new Map<string, { id: string; files: Record<string, { content: string }> }>();
  let next = 1;
  const handler = vi.fn(async (url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string>)?.Authorization;
    if (auth !== `Bearer ${token}`) return new Response('{}', { status: 401 });
    const path = url.replace('https://api.github.com', '');
    const body = init?.body ? (JSON.parse(init.body as string) as { files: Record<string, { content: string }> }) : null;
    if (path === '/user') return Response.json({ login: 'owner', name: 'Хозяин', avatar_url: 'https://example.test/a.png' });
    if (path.startsWith('/gists?')) return Response.json([...gists.values()]);
    if (path === '/gists' && init?.method === 'POST') {
      const g = { id: `g${next++}`, files: body!.files };
      gists.set(g.id, g);
      return Response.json(g);
    }
    const g = gists.get(path.replace('/gists/', ''));
    if (!g) return new Response('{}', { status: 404 });
    if (init?.method === 'PATCH') Object.assign(g.files, body!.files);
    return Response.json(g);
  });
  return { gists, handler };
}

function device(state: StateV4 = emptyState(1)) {
  let s = state;
  const listeners = new Set<() => void>();
  return {
    host: {
      get: () => s,
      replace: (n: StateV4) => {
        s = n;
        listeners.forEach((l) => l());
      },
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    },
    add(t: Task) {
      s = { ...s, personal: { ...s.personal, tasks: [...s.personal.tasks, t] } };
    },
    titles: () => s.personal.tasks.map((t) => t.title).sort(),
  };
}

beforeEach(() => localStorage.clear());

describe('crypto', () => {
  it('reads back what it sealed, and not with another key', async () => {
    const k = await keyFrom('a');
    const sealed = await sealText(k, 'секрет');
    expect(sealed).not.toContain('секрет');
    expect(await openText(k, sealed)).toBe('секрет');
    await expect(openText(await keyFrom('b'), sealed)).rejects.toBeTruthy();
  });
});

describe('sync', () => {
  it('makes a secret gist and leaves nothing readable in it', async () => {
    const gh = fakeGithub();
    vi.stubGlobal('fetch', gh.handler);
    const a = device();
    a.add(task('x', 5, 'Купить малако'));
    await createSync(a.host).connect(TOKEN);
    const [g] = [...gh.gists.values()];
    expect(g.files['moi-plan.json'].content).not.toContain('малако');
    const posted = gh.handler.mock.calls.find((c) => c[1]?.method === 'POST')!;
    expect(JSON.parse(posted[1]!.body as string).public).toBe(false);
  });

  it('carries tasks both ways between two devices', async () => {
    const gh = fakeGithub();
    vi.stubGlobal('fetch', gh.handler);
    const a = device();
    a.add(task('x', 5, 'с телефона'));
    const syncA = createSync(a.host);
    await syncA.connect(TOKEN);

    localStorage.clear();
    const b = device();
    b.add(task('y', 6, 'с компьютера'));
    const syncB = createSync(b.host);
    await syncB.connect(TOKEN);
    expect(b.titles()).toEqual(['с компьютера', 'с телефона']);
    expect(gh.gists.size).toBe(1);

    await syncA.syncNow();
    expect(a.titles()).toEqual(['с компьютера', 'с телефона']);
  });

  it('sends nothing when nothing changed', async () => {
    const gh = fakeGithub();
    vi.stubGlobal('fetch', gh.handler);
    const a = device();
    const s = createSync(a.host);
    await s.connect(TOKEN);
    const patches = () => gh.handler.mock.calls.filter((c) => c[1]?.method === 'PATCH').length;
    const before = patches();
    await s.syncNow();
    expect(patches()).toBe(before);
    expect(s.getStatus().state).toBe('ok');
  });

  it('refuses a wrong token and stays off', async () => {
    vi.stubGlobal('fetch', fakeGithub().handler);
    const s = createSync(device().host);
    await expect(s.connect('wrong')).rejects.toThrow(/токен/);
    expect(s.getStatus().state).toBe('off');
    expect(localStorage.getItem('sync_v1')).toBeNull();
  });

  it('says so when offline, and keeps the data', async () => {
    const gh = fakeGithub();
    vi.stubGlobal('fetch', gh.handler);
    const a = device();
    a.add(task('x', 5));
    const s = createSync(a.host);
    await s.connect(TOKEN);
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    await s.syncNow();
    expect(s.getStatus()).toMatchObject({ state: 'error', message: 'Нет связи с GitHub' });
    expect(a.titles()).toEqual(['x']);
  });
});
