/**
 * One-off migration (issue #7): every inline `[!OPEN]` and `[!CONFLICT]` callout becomes a
 * question issue, and the callout on both the English and Chinese page becomes a
 * `> [!ISSUE N]` marker. Titles and any Source overrides come from migrate-callouts.json.
 *
 * Usage:
 *   bun scripts/migrate-callouts.ts [--out <dir>]   dry run: writes the planned issues, changes nothing
 *   bun scripts/migrate-callouts.ts --live          creates labels and issues, then swaps in markers
 *
 * Live mode is idempotent: migrated callouts are markers and are skipped, and an issue
 * created before a crash is found again by the hidden key in its body.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Locale } from '../src/i18n/ui';
import {
  buildIssue,
  conflictSources,
  findCallouts,
  type Item,
  LABELS,
  migrationKey,
  type Pair,
  pairPage,
  type PlannedIssue,
  replaceWithMarker,
} from '../src/lib/migration/callouts';
import { REPO, WIKI_DIRS } from '../src/lib/site';

const ROOT = join(import.meta.dirname, '..');
const SLUG = new URL(REPO).pathname.slice(1);
const OVERRIDES = join(import.meta.dirname, 'migrate-callouts.json');
/** GitHub asks for a pause between content-creating requests; this stays well under its limits. */
const PAUSE_MS = 3000;

interface Override {
  en?: string;
  zh?: string;
  sources?: string[];
}

const args = process.argv.slice(2);
const live = args.includes('--live');
const outArg = args.indexOf('--out');
const out = outArg === -1 ? join(tmpdir(), 'oneiros-migration') : args[outArg + 1];

function pageFile(locale: Locale, slug: string): string | undefined {
  for (const ext of ['.md', '.mdx']) {
    const file = join(ROOT, WIKI_DIRS[locale], slug + ext);
    if (existsSync(file)) return file;
  }
  return undefined;
}

function read(locale: Locale, slug: string): string | undefined {
  const file = pageFile(locale, slug);
  return file ? readFileSync(file, 'utf8') : undefined;
}

function frontmatter(raw: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  return (match ? parseYaml(match[1]) : {}) ?? {};
}

function slugs(): string[] {
  const names = (['en', 'zh'] as Locale[]).flatMap((l) => readdirSync(join(ROOT, WIKI_DIRS[l])));
  return [
    ...new Set(names.filter((f) => /\.mdx?$/.test(f)).map((f) => f.replace(/\.mdx?$/, ''))),
  ].sort();
}

function pairAll(): Pair[] {
  const pairs: Pair[] = [];
  const problems: string[] = [];
  for (const slug of slugs()) {
    const result = pairPage(slug, read('en', slug), read('zh', slug));
    pairs.push(...result.pairs);
    problems.push(...result.problems);
  }
  if (problems.length) {
    console.error('English and Chinese callouts do not pair; nothing was changed:');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  return pairs;
}

function git(...gitArgs: string[]): string {
  return execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** The commit where the callout's opening words first appeared, as a Raised value. */
function raised(slug: string, text: string): string | undefined {
  const file = pageFile('en', slug);
  if (!file) return undefined;
  const needle = text.split('\n')[0].slice(0, 50);
  const log = git(
    'log',
    '--reverse',
    '--follow',
    '--format=%H%x09%ad',
    '--date=format:%-d %b %Y',
    '-S',
    needle,
    '--',
    file,
  );
  const first = log.split('\n')[0];
  if (!first) return undefined;
  const [sha, date] = first.split('\t');
  return `${date}, [${sha.slice(0, 7)}](${REPO}/commit/${sha})`;
}

interface Planned {
  pair: Pair;
  key: string;
  issue: PlannedIssue;
  zhTitle: string;
  warnings: string[];
}

function plan(pairs: Pair[], overrides: Record<string, Override>): Planned[] {
  const planned: Planned[] = [];
  for (const pair of pairs) {
    const { en, zh } = pair;
    if (en.type !== 'callout' || zh.type !== 'callout') continue;
    const key = `${pair.slug}#${pair.index}`;
    const override = overrides[key] ?? {};
    const warnings: string[] = [];
    if (!override.en) warnings.push('no English title');
    if (!override.zh) warnings.push('no Chinese title');
    let sources: string[] | undefined;
    if (en.kind === 'conflict') {
      sources = override.sources ?? conflictSources(en.text);
      if (sources.length < 2) warnings.push(`conflict names ${sources.length} source(s)`);
    }
    const enRaw = read('en', pair.slug) ?? '';
    const front = frontmatter(enRaw);
    const issue = buildIssue({
      slug: pair.slug,
      pageTitle: String(front.title ?? pair.slug),
      area: String(front.area ?? ''),
      index: pair.index,
      kind: en.kind,
      section: en.section,
      sources,
      raised: raised(pair.slug, en.text),
      title: { en: override.en ?? `TODO ${key}`, zh: override.zh ?? `TODO ${key}` },
      text: { en: en.text, zh: zh.text },
    });
    planned.push({ pair, key, issue, zhTitle: override.zh ?? '', warnings });
  }
  return planned;
}

function pending(pairs: Pair[]): Pair[] {
  return pairs.filter((p) => (p.en.type === 'marker') !== (p.zh.type === 'marker'));
}

function dryRun(pairs: Pair[], planned: Planned[]): void {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  planned.forEach((p, i) => {
    const name = `${String(i + 1).padStart(3, '0')}-${p.pair.slug}-${p.pair.index}.md`;
    const head = [`# ${p.issue.title}`, '', `Labels: ${p.issue.labels.join(', ')}`, '', '---', ''];
    writeFileSync(join(out, name), head.join('\n') + p.issue.body);
  });
  const warned = planned.filter((p) => p.warnings.length);
  const kinds = (k: string) => planned.filter((p) => p.issue.labels.includes(`kind:${k}`)).length;
  const summary = [
    '# Callout migration: dry run',
    '',
    `${planned.length} issues (${kinds('open')} open, ${kinds('conflict')} conflict) from ${new Set(planned.map((p) => p.pair.slug)).size} pages.`,
    `${pairs.length - planned.length - pending(pairs).length} callouts already migrated; ${pending(pairs).length} half-migrated pairs to finish.`,
    '',
    '## Labels',
    '',
    ...LABELS.map((l) => `- \`${l.name}\` #${l.color}: ${l.description}`),
    '',
    '## Warnings',
    '',
    ...(warned.length ? warned.map((p) => `- ${p.key}: ${p.warnings.join('; ')}`) : ['None.']),
    '',
    '## Issues',
    '',
    '| # | Callout | Labels | Title | Chinese title |',
    '|---|---|---|---|---|',
    ...planned.map(
      (p, i) =>
        `| ${i + 1} | ${p.key} | ${p.issue.labels.join(' ')} | ${p.issue.title} | ${p.zhTitle} |`,
    ),
    '',
  ];
  writeFileSync(join(out, 'SUMMARY.md'), summary.join('\n'));
  console.log(`Dry run: ${planned.length} issues, ${warned.length} with warnings. Wrote ${out}/`);
}

function gh(ghArgs: string[], input?: string): string {
  return execFileSync('gh', ghArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function ghLines(path: string, jq: string): string[] {
  return gh(['api', '--paginate', '--jq', jq, path]).split('\n').filter(Boolean);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureLabels(): Promise<void> {
  const existing = new Set(ghLines(`repos/${SLUG}/labels?per_page=100`, '.[].name'));
  for (const label of LABELS) {
    if (existing.has(label.name)) continue;
    gh(['api', '--method', 'POST', `repos/${SLUG}/labels`, '--input', '-'], JSON.stringify(label));
    console.log(`Created label ${label.name}`);
    await sleep(1000);
  }
}

function existingIssues(): Map<string, number> {
  const byKey = new Map<string, number>();
  const jq = '.[] | select(.pull_request | not) | {number, body}';
  for (const line of ghLines(`repos/${SLUG}/issues?state=all&per_page=100`, jq)) {
    const { number, body } = JSON.parse(line) as { number: number; body: string | null };
    const key = migrationKey(body ?? '');
    if (key) byKey.set(key, number);
  }
  return byKey;
}

/** Swaps the item at `index` on one page for a marker, re-reading the page first. */
function mark(locale: Locale, slug: string, index: number, issue: number): void {
  const file = pageFile(locale, slug);
  if (!file) throw new Error(`${slug}: no ${locale} page`);
  const raw = readFileSync(file, 'utf8');
  const item: Item | undefined = findCallouts(raw)[index - 1];
  if (!item) throw new Error(`${file}: no callout ${index}`);
  if (item.type === 'marker') {
    if (item.issue !== issue)
      throw new Error(`${file}: item ${index} is already issue ${item.issue}`);
    return;
  }
  writeFileSync(file, replaceWithMarker(raw, item, issue));
}

async function migrate(pairs: Pair[], planned: Planned[]): Promise<void> {
  const untitled = planned.filter((p) => p.warnings.some((w) => w.includes('title')));
  if (untitled.length) {
    console.error(`${untitled.length} callouts lack a title in ${OVERRIDES}; nothing was changed.`);
    process.exit(1);
  }
  for (const pair of pending(pairs)) {
    const issue = pair.en.type === 'marker' ? pair.en.issue : (pair.zh as { issue: number }).issue;
    for (const locale of ['en', 'zh'] as Locale[]) mark(locale, pair.slug, pair.index, issue);
    console.log(`Finished ${pair.slug}#${pair.index} as #${issue}`);
  }
  await ensureLabels();
  const existing = existingIssues();
  for (const p of planned) {
    let number = existing.get(p.key);
    if (number === undefined) {
      const created = gh(
        ['api', '--method', 'POST', `repos/${SLUG}/issues`, '--input', '-', '--jq', '.number'],
        JSON.stringify(p.issue),
      );
      number = Number(created);
      console.log(`Created #${number} for ${p.key}: ${p.issue.title}`);
      await sleep(PAUSE_MS);
    } else {
      console.log(`Found #${number} for ${p.key}`);
    }
    for (const locale of ['en', 'zh'] as Locale[]) mark(locale, p.pair.slug, p.pair.index, number);
  }
  console.log(`Migrated ${planned.length} callouts.`);
}

const overrides = existsSync(OVERRIDES)
  ? (JSON.parse(readFileSync(OVERRIDES, 'utf8')) as Record<string, Override>)
  : {};
const pairs = pairAll();
const planned = plan(pairs, overrides);
if (live) await migrate(pairs, planned);
else dryRun(pairs, planned);
