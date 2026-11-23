/**
 * Links between question issues, as a plan the designer approves and `scripts/question-links.ts`
 * applies: blocked-by links (GitHub's issue dependencies), Related rows and Undermined by rows
 * (the property table in the issue body).
 */
import { ISSUE_REF } from '.';

export const RELATIONS = ['blocked-by', 'related', 'undermined-by'] as const;
export type Relation = (typeof RELATIONS)[number];

/** One approved change: `add #16 blocked-by #15` means #16 is blocked by #15. */
export interface LinkChange {
  action: 'add' | 'remove';
  relation: Relation;
  issue: number;
  other: number;
  reason?: string;
}

const LINE =
  /^(add|remove)\s+#?(\d+)\s+(blocked-by|related|undermined-by)\s+#?(\d+)\s*(?::\s*(.*))?$/;
const FENCE = /^(```|~~~)\s*(\S*)/;
const PLAN_BLOCK = 'question-links';
const COMMENT = /^(#(\s|#|$)|$)/;

interface PlanLine {
  n: number;
  text: string;
}

/** The plan's lines, numbered: inside its `question-links` blocks when it has any. */
function planLines(plan: string): PlanLine[] {
  const lines = plan
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((text, i) => ({ n: i + 1, text: text.trim() }));
  if (!lines.some((l) => FENCE.exec(l.text)?.[2] === PLAN_BLOCK)) return lines;
  const inside: PlanLine[] = [];
  let block: string | undefined;
  for (const line of lines) {
    const fence = FENCE.exec(line.text);
    if (fence) block = block === undefined ? fence[2] : undefined;
    else if (block === PLAN_BLOCK) inside.push(line);
  }
  return inside;
}

/**
 * Parses a plan: one change per line, such as `add #16 blocked-by #15: <reason>`; blank lines
 * and `#` comment lines are skipped. In Markdown, only `question-links` code blocks count.
 */
export function parsePlan(plan: string): LinkChange[] {
  const changes: LinkChange[] = [];
  for (const { n, text } of planLines(plan)) {
    if (COMMENT.test(text)) continue;
    const match = LINE.exec(text);
    if (!match || match[2] === match[4]) throw new Error(`line ${n}: ${text}`);
    const change: LinkChange = {
      action: match[1] as LinkChange['action'],
      relation: match[3] as Relation,
      issue: Number(match[2]),
      other: Number(match[4]),
    };
    if (match[5]) change.reason = match[5].trim();
    changes.push(change);
  }
  return changes;
}

/** The property rows an issue's table holds, in the order of docs/open-questions.md. */
const ROW_ORDER = ['page', 'section', 'source', 'raised', 'related', 'undermined by'];
export type LinkRow = 'Related' | 'Undermined by';

function rowName(line: string): string {
  return line.trim().replace(/^\|/, '').split('|')[0].trim().toLowerCase();
}

/**
 * Adds and removes issue numbers in one row of an issue body's property table, which comes
 * before the first `## ` section. Writes the row as `#a, #b` in number order, inserts a missing
 * row in the order of docs/open-questions.md and drops a row left empty. Nothing else in the body changes.
 */
export function editRow(
  body: string,
  row: LinkRow,
  { add = [], remove = [] }: { add?: number[]; remove?: number[] },
): string {
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const lines = body.split(/\r?\n/);
  let lead = lines.findIndex((l) => /^##\s/.test(l));
  if (lead === -1) lead = lines.length;
  let start = lines.findIndex((l, i) => i < lead && l.trim().startsWith('|'));
  if (start === -1) {
    if (!add.length) return body;
    lines.splice(0, 0, '| Property | Value |', '|---|---|', '');
    start = 0;
    lead += 3;
  }
  let stop = start;
  while (stop < lead && lines[stop].trim().startsWith('|')) stop++;
  const rows = lines.slice(start + 2, stop);

  const name = row.toLowerCase();
  const at = rows.findIndex((l) => rowName(l) === name);
  const current = at === -1 ? [] : [...rows[at].matchAll(ISSUE_REF)].map((m) => Number(m[1]));
  const numbers = [...new Set([...current, ...add])]
    .filter((n) => !remove.includes(n))
    .sort((a, b) => a - b);
  const written = `| ${row} | ${numbers.map((n) => `#${n}`).join(', ')} |`;

  if (at !== -1) rows.splice(at, 1, ...(numbers.length ? [written] : []));
  else if (numbers.length) {
    const rank = ROW_ORDER.indexOf(name);
    const after = rows.findIndex((l) => {
      const other = ROW_ORDER.indexOf(rowName(l));
      return other === -1 || other > rank;
    });
    rows.splice(after === -1 ? rows.length : after, 0, written);
  }
  return [...lines.slice(0, start + 2), ...rows, ...lines.slice(stop)].join(eol);
}

/** An issue as the helper reads it from GitHub. */
export interface LinkedIssue {
  body: string;
  /** The issues it is blocked by. */
  blockedBy: number[];
}

export interface PlannedChanges {
  /** Issue bodies whose property table changes, by issue number. */
  bodies: { issue: number; before: string; after: string }[];
  /** Blocked-by links to create: `issue` is blocked by `blocker`. */
  block: { issue: number; blocker: number }[];
  unblock: { issue: number; blocker: number }[];
  /** Changes already true on GitHub. */
  skipped: string[];
}

/**
 * What applying a plan to these issues does. A Related change edits both issues' rows (it has
 * no order); an Undermined by change edits only the undermined issue's row.
 */
export function planChanges(
  changes: LinkChange[],
  issues: ReadonlyMap<number, LinkedIssue>,
): PlannedChanges {
  const issue = (n: number) => {
    const found = issues.get(n);
    if (!found) throw new Error(`#${n} is not a question issue`);
    return found;
  };
  const bodies = new Map<number, string>();
  const edit = (n: number, row: LinkRow, change: LinkChange, other: number) => {
    const before = bodies.get(n) ?? issue(n).body;
    const numbers = change.action === 'add' ? { add: [other] } : { remove: [other] };
    bodies.set(n, editRow(before, row, numbers));
  };
  const result: PlannedChanges = { bodies: [], block: [], unblock: [], skipped: [] };

  const actions = new Map<string, LinkChange['action']>();
  for (const change of changes) {
    const { issue: n, other } = change;
    issue(n);
    issue(other);
    const pair = change.relation === 'related' ? [n, other].sort((a, b) => a - b) : [n, other];
    const key = `${change.relation} ${pair.join(' ')}`;
    if ((actions.get(key) ?? change.action) !== change.action) {
      throw new Error(`the plan both adds and removes #${n} ${change.relation} #${other}`);
    }
    actions.set(key, change.action);
    if (change.relation === 'related') {
      edit(n, 'Related', change, other);
      edit(other, 'Related', change, n);
    } else if (change.relation === 'undermined-by') {
      edit(n, 'Undermined by', change, other);
    } else {
      const linked = issue(n).blockedBy.includes(other);
      if (change.action === 'add' && linked) {
        result.skipped.push(`#${n} is already blocked by #${other}`);
      } else if (change.action === 'remove' && !linked) {
        result.skipped.push(`#${n} is not blocked by #${other}`);
      } else {
        result[change.action === 'add' ? 'block' : 'unblock'].push({ issue: n, blocker: other });
      }
    }
  }
  for (const [n, after] of [...bodies].sort(([a], [b]) => a - b)) {
    const before = issue(n).body;
    if (after !== before) result.bodies.push({ issue: n, before, after });
  }
  return result;
}
