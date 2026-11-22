/**
 * The one way the scripts reach GitHub: every call by name, for this repo's question issues
 * and milestones. `liveGitHub()` runs them with the `gh` CLI (signed in); `fakeGitHub()` in
 * `github-fake.ts` keeps them in memory for tests. Every text the live module sends goes as a
 * JSON request body (`gh api --input -`), never on the command line.
 */
import { execFileSync } from 'node:child_process';
import type { PulledIssue } from '../src/lib/questions';
import type { MilestoneText } from '../src/lib/questions/constellation-format';
import type { GithubMilestone, MilestonedIssue } from '../src/lib/questions/constellations';
import { REPO } from '../src/lib/site';

/** This repo as `owner/name`. */
export const SLUG = new URL(REPO).pathname.slice(1);

/** A question issue with everything the pull fetches for it. */
export type PulledQuestion = PulledIssue & MilestonedIssue;

/** How an issue is closed. */
export type Close = { reason: 'completed' | 'not_planned' } | { duplicateOf: number };

export interface GitHub {
  /** Every question issue (labelled `kind:open` or `kind:conflict`), open and closed. */
  questions(): PulledQuestion[];
  /** One question issue; throws when the issue is not a question issue. */
  question(number: number): PulledQuestion;
  /** Every milestone, open and closed. */
  milestones(): GithubMilestone[];
  editIssueBody(issue: number, body: string): void;
  /** Makes `issue` blocked by `blocker`. */
  addBlockedBy(issue: number, blocker: number): void;
  removeBlockedBy(issue: number, blocker: number): void;
  closeIssue(issue: number, close: Close): void;
  assignMilestone(issue: number, milestone: number): void;
  removeMilestone(issue: number): void;
  /** Returns the new milestone's number. */
  createMilestone(text: MilestoneText): number;
  editMilestone(milestone: number, text: Partial<MilestoneText>): void;
  closeMilestone(milestone: number): void;
}

export const KIND_LABELS = ['kind:open', 'kind:conflict'];

/** Whether an issue's labels make it a question issue. */
export function isQuestionIssue(issue: Pick<PulledQuestion, 'labels' | 'pull_request'>): boolean {
  if (issue.pull_request) return false;
  return issue.labels.some((l) => KIND_LABELS.includes(typeof l === 'string' ? l : l.name));
}

interface RestIssue extends PulledQuestion {
  id: number;
  node_id: string;
}

const DUPLICATE_OF = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) { duplicateOf { number repository { nameWithOwner } } }
  }
}`;

const CLOSE_AS_DUPLICATE = `mutation($id: ID!, $of: ID!) {
  closeIssue(input: {issueId: $id, stateReason: DUPLICATE, duplicateIssueId: $of}) { issue { number } }
}`;

/** The `gh` CLI against this repo. */
export function liveGitHub(): GitHub {
  const [owner, name] = SLUG.split('/');
  const issues = new Map<number, RestIssue>();

  function api(args: string[], body?: object): string {
    const input = body === undefined ? [] : ['--input', '-'];
    return execFileSync('gh', ['api', ...args, ...input], {
      encoding: 'utf8',
      input: body === undefined ? undefined : JSON.stringify(body),
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  }
  const send = (method: string, path: string, body: object, ...args: string[]) =>
    api(['-X', method, `repos/${SLUG}/${path}`, ...args], body);

  /** Every item of a paginated list endpoint. */
  function list<T>(path: string): T[] {
    return api(['--paginate', '--jq', '.[]', `repos/${SLUG}/${path}`])
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }

  function graphql<T>(query: string, variables: object): T {
    return (JSON.parse(api(['graphql'], { query, variables })) as { data: T }).data;
  }

  function fetchIssue(number: number): RestIssue {
    const issue = JSON.parse(api([`repos/${SLUG}/issues/${number}`])) as RestIssue;
    issues.set(number, issue);
    return issue;
  }
  /** An issue for its `id` and `node_id`, which never change. */
  const known = (number: number) => issues.get(number) ?? fetchIssue(number);

  /**
   * The issue a duplicate was closed as a duplicate of, in this repo. REST's
   * `marked_as_duplicate` timeline event does not name it, and GraphQL's
   * `MarkedAsDuplicateEvent` swaps its canonical and duplicate sides, so this reads
   * `Issue.duplicateOf`.
   */
  function duplicateOf(number: number): number | undefined {
    type Target = { number: number; repository: { nameWithOwner: string } } | null;
    const data = graphql<{ repository: { issue: { duplicateOf: Target } } }>(DUPLICATE_OF, {
      owner,
      name,
      number,
    });
    const target = data.repository.issue.duplicateOf;
    return target && target.repository.nameWithOwner.toLowerCase() === SLUG.toLowerCase()
      ? target.number
      : undefined;
  }

  function pulled(issue: RestIssue): PulledQuestion {
    issues.set(issue.number, issue);
    return {
      ...issue,
      blockedBy: list(`issues/${issue.number}/dependencies/blocked_by?per_page=100`),
      issueComments: issue.comments ? list(`issues/${issue.number}/comments?per_page=100`) : [],
      ...(issue.state_reason === 'duplicate' && { duplicateOf: duplicateOf(issue.number) }),
    };
  }

  const blockedBy = (n: number) => `issues/${n}/dependencies/blocked_by`;

  return {
    questions() {
      const byNumber = new Map<number, RestIssue>();
      for (const label of KIND_LABELS) {
        const path = `issues?labels=${encodeURIComponent(label)}&state=all&per_page=100`;
        for (const issue of list<RestIssue>(path)) byNumber.set(issue.number, issue);
      }
      return [...byNumber.values()].filter(isQuestionIssue).map(pulled);
    },
    question(number) {
      const issue = fetchIssue(number);
      if (!isQuestionIssue(issue)) throw new Error(`#${number} is not a question issue`);
      return pulled(issue);
    },
    milestones: () => list<GithubMilestone>('milestones?state=all&per_page=100'),
    editIssueBody(issue, body) {
      send('PATCH', `issues/${issue}`, { body }, '--silent');
    },
    addBlockedBy(issue, blocker) {
      send('POST', blockedBy(issue), { issue_id: known(blocker).id }, '--silent');
    },
    removeBlockedBy(issue, blocker) {
      api(['-X', 'DELETE', `repos/${SLUG}/${blockedBy(issue)}/${known(blocker).id}`, '--silent']);
    },
    closeIssue(issue, close) {
      if ('duplicateOf' in close) {
        graphql(CLOSE_AS_DUPLICATE, {
          id: known(issue).node_id,
          of: known(close.duplicateOf).node_id,
        });
      } else {
        send(
          'PATCH',
          `issues/${issue}`,
          { state: 'closed', state_reason: close.reason },
          '--silent',
        );
      }
    },
    assignMilestone(issue, milestone) {
      send('PATCH', `issues/${issue}`, { milestone }, '--silent');
    },
    removeMilestone(issue) {
      send('PATCH', `issues/${issue}`, { milestone: null }, '--silent');
    },
    createMilestone({ title, description }) {
      return Number(send('POST', 'milestones', { title, description }, '--jq', '.number'));
    },
    editMilestone(milestone, { title, description }) {
      send('PATCH', `milestones/${milestone}`, { title, description }, '--silent');
    },
    closeMilestone(milestone) {
      send('PATCH', `milestones/${milestone}`, { state: 'closed' }, '--silent');
    },
  };
}
