const base = document.body.dataset.base ?? '/';

/* Theme: system, light, dark. */
const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];
const themeBtn = document.querySelector<HTMLButtonElement>('.theme-btn');

function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'system';
}

function showTheme(theme: Theme): void {
  if (!themeBtn) return;
  themeBtn.setAttribute('aria-label', `Theme: ${theme}`);
  const label = themeBtn.querySelector('.lbl');
  if (label) label.textContent = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';
}

showTheme(currentTheme());
themeBtn?.addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
  if (next === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  try {
    if (next === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', next);
  } catch {
    /* Storage unavailable: the choice lasts for this page only. */
  }
  showTheme(next);
});

/* Mobile menu. */
const menuBtn = document.querySelector<HTMLButtonElement>('.menu-btn');
const shell = document.querySelector('.shell');
menuBtn?.addEventListener('click', () => {
  const open = shell?.classList.toggle('menu-open') ?? false;
  menuBtn.setAttribute('aria-expanded', String(open));
});

/* Contents box. */
for (const toc of document.querySelectorAll<HTMLElement>('.toc')) {
  const btn = toc.querySelector('button');
  btn?.addEventListener('click', () => {
    const closed = toc.toggleAttribute('data-closed');
    btn.setAttribute('aria-expanded', String(!closed));
  });
}

/* Hover previews, fed by previews.json on first use. */
type Previews = Record<string, [string, string]>;
const pop = document.getElementById('pop');
let previews: Promise<Previews> | undefined;

function loadPreviews(): Promise<Previews> {
  previews ??= fetch(`${base}previews.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Previews>) : {}))
    .catch(() => ({}));
  return previews;
}

async function showPreview(a: HTMLAnchorElement): Promise<void> {
  if (!pop) return;
  const data = (await loadPreviews())[a.dataset.t ?? ''];
  if (!data || !a.matches(':hover, :focus-visible')) return;
  const title = document.createElement('b');
  title.textContent = data[0];
  pop.replaceChildren(title, document.createTextNode(data[1]));
  pop.style.display = 'block';
  const r = a.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 12))}px`;
  const below = r.bottom + 8;
  pop.style.top = `${below + pop.offsetHeight > innerHeight ? r.top - pop.offsetHeight - 8 : below}px`;
}

function hidePreview(): void {
  if (pop) pop.style.display = 'none';
}

function previewTarget(e: Event): HTMLAnchorElement | null {
  return (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[data-t]') ?? null;
}

document.addEventListener('mouseover', (e) => {
  const a = previewTarget(e);
  if (a) void showPreview(a);
});
document.addEventListener('focusin', (e) => {
  const a = previewTarget(e);
  if (a) void showPreview(a);
});
document.addEventListener('mouseout', (e) => {
  if (previewTarget(e)) hidePreview();
});
document.addEventListener('focusout', (e) => {
  if (previewTarget(e)) hidePreview();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hidePreview();
});
addEventListener('scroll', hidePreview, { passive: true });

/* Search, through the Pagefind JS API. */
interface PagefindResult {
  data(): Promise<{ url: string; excerpt: string; meta: { title?: string } }>;
}
interface Pagefind {
  options(o: Record<string, unknown>): Promise<void>;
  debouncedSearch(q: string): Promise<{ results: PagefindResult[] } | null>;
}

const form = document.querySelector<HTMLFormElement>('.search');
const input = document.querySelector<HTMLInputElement>('#q');
const list = document.querySelector<HTMLUListElement>('#results');
let pagefind: Promise<Pagefind | undefined> | undefined;
let active = -1;

function loadPagefind(): Promise<Pagefind | undefined> {
  const src = `${base}pagefind/pagefind.js`;
  pagefind ??= import(/* @vite-ignore */ src)
    .then(async (mod: Pagefind) => {
      await mod.options({ baseUrl: base, excerptLength: 18 });
      return mod;
    })
    .catch(() => undefined);
  return pagefind;
}

function setOpen(open: boolean): void {
  if (!list || !input) return;
  list.hidden = !open;
  input.setAttribute('aria-expanded', String(open));
  if (!open) {
    active = -1;
    input.removeAttribute('aria-activedescendant');
  }
}

function message(text: string): void {
  if (!list) return;
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  list.replaceChildren(li);
  setOpen(true);
}

function options(): HTMLAnchorElement[] {
  return [...(list?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
}

function highlight(i: number): void {
  const opts = options();
  if (!opts.length || !input) return;
  active = (i + opts.length) % opts.length;
  opts.forEach((a, n) => a.setAttribute('aria-selected', String(n === active)));
  input.setAttribute('aria-activedescendant', opts[active].id);
  opts[active].scrollIntoView({ block: 'nearest' });
}

async function runSearch(q: string): Promise<void> {
  if (!list) return;
  if (!q.trim()) return setOpen(false);
  const pf = await loadPagefind();
  if (!pf) return message('Search is available on the built site.');
  const search = await pf.debouncedSearch(q);
  if (!search || input?.value !== q) return;
  if (!search.results.length) return message('No pages match.');
  const items = await Promise.all(search.results.slice(0, 8).map((r) => r.data()));
  if (input?.value !== q) return;
  list.replaceChildren(
    ...items.map((item, i) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.url;
      a.id = `result-${i}`;
      a.setAttribute('role', 'option');
      a.setAttribute('aria-selected', 'false');
      const title = document.createElement('b');
      title.textContent = item.meta.title ?? item.url;
      const excerpt = document.createElement('span');
      excerpt.innerHTML = item.excerpt;
      a.append(title, excerpt);
      li.append(a);
      return li;
    }),
  );
  active = -1;
  setOpen(true);
}

input?.addEventListener('input', () => void runSearch(input.value));
input?.addEventListener('focus', () => {
  void loadPagefind();
  if (input.value.trim() && list?.children.length) setOpen(true);
});
input?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlight(active + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlight(active - 1);
  } else if (e.key === 'Escape') {
    setOpen(false);
  }
});
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const target = options()[Math.max(active, 0)];
  if (target) location.href = target.href;
});
document.addEventListener('click', (e) => {
  if (!form?.contains(e.target as Node)) setOpen(false);
});
