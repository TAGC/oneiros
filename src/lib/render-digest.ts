import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../i18n/locale';
import { QUESTION_CACHE } from './questions';
import { allSources } from './wiki';

/** Code and data, other than a page's own file, that its rendered Markdown depends on. */
const INPUTS = ['src/lib', 'src/i18n', 'bun.lock', QUESTION_CACHE];

function files(root: string, path: string): string[] {
  try {
    return readdirSync(join(root, path), { withFileTypes: true })
      .flatMap((d) => (d.isDirectory() ? files(root, join(path, d.name)) : [join(path, d.name)]))
      .sort();
  } catch {
    return [path];
  }
}

/**
 * A hash of every page's link target (slug, title, aliases, summary) and of the code that
 * renders wiki links, and of the question cache that fills question markers. Astro reuses a
 * Markdown file's rendered HTML until the file or the Astro config changes, so the config
 * carries this to re-render every page when a link or a question would render differently,
 * without `--force`.
 */
export function renderDigest(root = process.cwd()): string {
  const hash = createHash('sha256');
  for (const path of INPUTS.flatMap((p) => files(root, p))) {
    hash.update(path);
    try {
      hash.update(readFileSync(join(root, path)));
    } catch {
      hash.update('missing');
    }
  }
  for (const locale of LOCALES) {
    const sources = [...allSources(locale)].sort((a, b) => a.slug.localeCompare(b.slug));
    for (const s of sources) {
      hash.update(JSON.stringify([locale, s.slug, s.title, s.aliases, s.summary]));
    }
  }
  return hash.digest('hex').slice(0, 16);
}
