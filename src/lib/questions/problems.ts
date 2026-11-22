/**
 * Checks over question data, run by `bun run check`: markers on pages against their issues,
 * and each issue's own format. Kept here so they can be tested without a build.
 */
import { DEFAULT_LOCALE, LOCALES, type Locale, useTranslations } from '../../i18n/ui';
import { sourceName } from '../wiki';
import { QUESTION_CACHE, questionGraph, type Questions } from '.';
import type { Marker, Misspelt, OldCallout } from './markers';

export interface Problem {
  where: string;
  message: string;
  detail?: string[];
}

/** A wiki page and the `[!ISSUE N]` markers on it, in page order. */
export interface MarkedPage {
  /** Repo-relative path, for reports. */
  file: string;
  locale: Locale;
  slug: string;
  status?: unknown;
  markers: Marker[];
  /** Old inline `[!OPEN]` and `[!CONFLICT]` callouts, which fail the checks. */
  callouts?: OldCallout[];
  /** Other spellings of a marker, which fail the checks. */
  misspelt?: Misspelt[];
}

const LOCKED = new Set(['Certainty', 'Dogma']);

const numbers = (list: number[]) => list.map((n) => `#${n}`).join(', ') || 'none';

/**
 * Every marker names an open question issue (a duplicate's failure names its canonical issue
 * and that issue's page); an English marker's issue has a Page row naming its page; English
 * and Chinese pages carry the same markers; Certainty and Dogma pages hold none; no page holds
 * an inline callout or another spelling of a marker.
 */
export function markerProblems(questions: Questions, pages: MarkedPage[]): Problem[] {
  const problems: Problem[] = [];
  for (const page of pages) {
    for (const { kind, line } of page.callouts ?? []) {
      problems.push({
        where: `${page.file}:${line}`,
        message: `inline [!${kind.toUpperCase()}] callout; make it a question issue and put a \`> [!ISSUE N]\` marker here`,
      });
    }
    for (const { found, issue, line } of page.misspelt ?? []) {
      problems.push({
        where: `${page.file}:${line}`,
        message: `\`${found}\` is not a marker; write \`> [!ISSUE ${issue ?? 'N'}]\`, alone in a quote of its own`,
      });
    }
    for (const { issue, line } of page.markers) {
      const where = `${page.file}:${line}`;
      const question = questions.get(issue);
      if (!question) {
        problems.push({
          where,
          message: `marker names #${issue}, which is not a question issue in ${QUESTION_CACHE}/ (run \`bun run pull\`)`,
        });
      } else if (question.duplicateOf !== undefined) {
        const n = question.duplicateOf;
        const home = questions.get(n)?.properties.page;
        problems.push({
          where,
          message: home
            ? `marker names #${issue}, a duplicate of #${n} on ${home}; replace the marker with one line linking to #${n} there`
            : `marker names #${issue}, a duplicate of #${n}, which has no Page row; replace the marker with one line linking to #${n} on its page`,
        });
      } else if (question.state === 'closed') {
        problems.push({
          where,
          message: `marker names #${issue}, which is closed; replace the marker with the settled text`,
        });
      } else if (page.locale === DEFAULT_LOCALE && !question.properties.page) {
        problems.push({
          where,
          message: `#${issue} has no Page row; it should link to this page`,
        });
      } else if (page.locale === DEFAULT_LOCALE && question.properties.page !== page.slug) {
        problems.push({
          where,
          message: `#${issue} has Page ${question.properties.page}, but its marker is on ${page.slug}`,
        });
      }
      if (LOCKED.has(String(page.status))) {
        problems.push({
          where,
          message: `${String(page.status)} page holds question #${issue}; resolve it or lower the status`,
        });
      }
    }
  }

  const english = new Map(
    pages.filter((p) => p.locale === DEFAULT_LOCALE).map((p) => [p.slug, p] as const),
  );
  for (const page of pages) {
    const en = page.locale === DEFAULT_LOCALE ? undefined : english.get(page.slug);
    if (!en) continue;
    const want = en.markers.map((m) => m.issue);
    const got = page.markers.map((m) => m.issue);
    if (want.join() === got.join()) continue;
    problems.push({
      where: page.file,
      message: `markers ${numbers(got)}, English has ${numbers(want)}`,
      detail: [`English page ${en.file}`],
    });
  }
  return problems;
}

/**
 * Every issue has a section for each site locale and a Chinese title; a closed issue other
 * than a duplicate has an answer comment, with a section for each locale; a duplicate names a
 * canonical question issue that is not itself a duplicate; blocked-by links and Undermined by
 * rows name question issues; a conflict names at least two sources, each a wiki link to a page
 * in every locale or a listed non-page source.
 */
export function issueProblems(questions: Questions): Problem[] {
  const problems: Problem[] = [];
  const listed = Object.keys(useTranslations(DEFAULT_LOCALE).conflictSources).join(', ');
  for (const q of questions.all()) {
    const report = (message: string) => problems.push({ where: q.url, message });
    for (const locale of LOCALES) {
      if (q.text[locale] === undefined) report(`no \`## ${locale}\` section`);
      else if (locale !== DEFAULT_LOCALE && !q.title[locale])
        report(`the \`## ${locale}\` section has no \`### \` title line`);
    }
    if (q.answer) {
      for (const locale of LOCALES) {
        if (!q.answer[locale]) report(`the answer comment has no \`### ${locale}\` section`);
      }
    }
    if (q.status === 'duplicate') {
      const target = q.duplicateOf === undefined ? undefined : questions.get(q.duplicateOf);
      if (q.duplicateOf === undefined)
        report('closed as a duplicate, but GitHub names no canonical issue in this repo');
      else if (!target)
        report(
          `a duplicate of #${q.duplicateOf}, which is not a question issue in ${QUESTION_CACHE}/ (missing, or no \`kind:\` label)`,
        );
      else if (target.status === 'duplicate') {
        const root =
          target.duplicateOf === undefined ? 'its canonical issue' : `#${target.duplicateOf}`;
        report(
          `a duplicate of #${target.number}, which is itself a duplicate of ${root}; mark #${q.number} a duplicate of ${root}`,
        );
      }
    } else if (q.state === 'closed' && !q.answer) report('closed with no answer comment');
    for (const n of q.blockedBy) {
      if (!questions.get(n))
        report(
          `blocked by #${n}, which is not a question (no \`kind:open\` or \`kind:conflict\` label)`,
        );
    }
    for (const n of q.underminedBy) {
      if (!questions.get(n)) report(`Undermined by names #${n}, which is not a question issue`);
    }
    if (q.kind !== 'conflict') continue;
    const sources = q.properties.sources ?? [];
    if (sources.length < 2)
      report(`a conflict needs at least two sources; the Source row names ${sources.length}`);
    for (const source of sources) {
      const missing = LOCALES.filter((l) => sourceName(source, l) === undefined);
      if (!missing.length) continue;
      if (/^\[\[.*\]\]$/.test(source.trim()))
        report(`Source "${source}" links to no page in ${missing.join(', ')}`);
      else report(`Source "${source}" is neither a wiki link nor one of: ${listed}`);
    }
  }
  return problems;
}

/** Every blocked-by cycle fails once, at its first question, naming all of its questions. */
export function cycleProblems(questions: Questions): Problem[] {
  return questionGraph(questions.all()).cycles.map((cycle) => ({
    where: questions.get(cycle[0])?.url ?? `#${cycle[0]}`,
    message: `blocked-by cycle through ${numbers(cycle)}; remove one of its blocked-by links`,
  }));
}
