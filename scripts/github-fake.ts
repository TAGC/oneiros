/**
 * An in-memory GitHub for tests: the same calls as `liveGitHub()`, holding issues and
 * milestones in memory and refusing what GitHub refuses (a missing issue or milestone, a link
 * that is already there or not there, a milestone title in use).
 */
import { REPO } from '../src/lib/site';
import type { GithubMilestone } from '../src/lib/questions/constellations';
import { type GitHub, isQuestionIssue, NotAQuestion, type PulledQuestion } from './github';

export interface FakeIssue {
  number: number;
  title: string;
  body?: string;
  labels: string[];
  state?: 'open' | 'closed';
  state_reason?: PulledQuestion['state_reason'];
  milestone?: number;
  blockedBy?: number[];
  comments?: string[];
  duplicateOf?: number;
  pull_request?: boolean;
}

interface FakeMilestone {
  number: number;
  title: string;
  description?: string;
  state?: 'open' | 'closed';
}

export interface FakeGitHub extends GitHub {
  /** Every write made, one line each, in order. */
  writes: string[];
}

export function fakeGitHub(seed: {
  issues?: FakeIssue[];
  milestones?: FakeMilestone[];
}): FakeGitHub {
  type HeldIssue = FakeIssue & Required<Pick<FakeIssue, 'state' | 'blockedBy' | 'comments'>>;
  type HeldMilestone = FakeMilestone & Required<Pick<FakeMilestone, 'state'>>;
  const issues = new Map<number, HeldIssue>(
    (seed.issues ?? []).map((i) => [
      i.number,
      { state: 'open', blockedBy: [], comments: [], ...structuredClone(i) },
    ]),
  );
  const milestones = new Map<number, HeldMilestone>(
    (seed.milestones ?? []).map((m) => [m.number, { state: 'open', ...structuredClone(m) }]),
  );
  const writes: string[] = [];

  function issue(n: number) {
    const found = issues.get(n);
    if (!found) throw new Error(`fake GitHub: no issue #${n}`);
    return found;
  }
  function milestone(n: number) {
    const found = milestones.get(n);
    if (!found) throw new Error(`fake GitHub: no milestone ${n}`);
    return found;
  }

  function pulled(n: number): PulledQuestion {
    const i = issue(n);
    return {
      number: i.number,
      title: i.title,
      body: i.body ?? null,
      state: i.state,
      state_reason: i.state_reason ?? null,
      labels: i.labels.map((name) => ({ name })),
      html_url: `${REPO}/issues/${i.number}`,
      comments: i.comments.length,
      ...(i.pull_request && { pull_request: {} }),
      milestone: i.milestone === undefined ? null : { number: i.milestone },
      blockedBy: i.blockedBy.map((number) => ({ number })),
      issueComments: i.comments.map((body) => ({ body })),
      ...(i.state_reason === 'duplicate' && { duplicateOf: i.duplicateOf }),
    };
  }

  return {
    writes,
    questions: () =>
      [...issues.keys()]
        .sort((a, b) => a - b)
        .map(pulled)
        .filter(isQuestionIssue),
    question(n) {
      if (!issues.has(n) || !isQuestionIssue(pulled(n))) throw new NotAQuestion(n);
      return pulled(n);
    },
    milestones: () =>
      [...milestones.values()]
        .sort((a, b) => a.number - b.number)
        .map((m): GithubMilestone => ({
          number: m.number,
          title: m.title,
          description: m.description ?? null,
          state: m.state,
          html_url: `${REPO}/milestone/${m.number}`,
        })),
    editIssueBody(n, body) {
      issue(n).body = body;
      writes.push(`edit #${n} body`);
    },
    addBlockedBy(n, blocker) {
      const blocked = issue(n);
      issue(blocker);
      if (n === blocker || blocked.blockedBy.includes(blocker)) {
        throw new Error(`fake GitHub: #${n} cannot be blocked by #${blocker} again`);
      }
      blocked.blockedBy.push(blocker);
      writes.push(`block #${n} by #${blocker}`);
    },
    removeBlockedBy(n, blocker) {
      const blocked = issue(n);
      if (!blocked.blockedBy.includes(blocker)) {
        throw new Error(`fake GitHub: #${n} is not blocked by #${blocker}`);
      }
      blocked.blockedBy = blocked.blockedBy.filter((b) => b !== blocker);
      writes.push(`unblock #${n} from #${blocker}`);
    },
    closeIssue(n, close) {
      const closed = issue(n);
      if ('duplicateOf' in close) {
        issue(close.duplicateOf);
        if (close.duplicateOf === n) throw new Error(`fake GitHub: #${n} cannot duplicate itself`);
        closed.state_reason = 'duplicate';
        closed.duplicateOf = close.duplicateOf;
        writes.push(`close #${n} as a duplicate of #${close.duplicateOf}`);
      } else {
        closed.state_reason = close.reason;
        delete closed.duplicateOf;
        writes.push(`close #${n} as ${close.reason}`);
      }
      closed.state = 'closed';
    },
    assignMilestone(n, number) {
      const assigned = issue(n);
      milestone(number);
      assigned.milestone = number;
      writes.push(`assign #${n} to milestone ${number}`);
    },
    removeMilestone(n) {
      delete issue(n).milestone;
      writes.push(`remove #${n} from its milestone`);
    },
    createMilestone({ title, description }) {
      if ([...milestones.values()].some((m) => m.title === title)) {
        throw new Error(`fake GitHub: a milestone is already titled "${title}"`);
      }
      const number = Math.max(0, ...milestones.keys()) + 1;
      milestones.set(number, { number, title, description, state: 'open' });
      writes.push(`create milestone ${number}`);
      return number;
    },
    editMilestone(number, { title, description }) {
      const edited = milestone(number);
      if (title !== undefined) edited.title = title;
      if (description !== undefined) edited.description = description;
      writes.push(`edit milestone ${number}`);
    },
    closeMilestone(number) {
      milestone(number).state = 'closed';
      writes.push(`close milestone ${number}`);
    },
  };
}
