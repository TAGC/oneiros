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

/** The ids GitHub's write calls take instead of an issue's number. */
interface IssueIds {
  /** REST's `id`, GraphQL's `databaseId`. */
  id: number;
  /** REST's `node_id`, GraphQL's `id`. */
  node_id: string;
}

const PAGE = 100;

/** An issue as the GraphQL query below returns it. */
interface GraphIssue {
  id: string;
  databaseId: number;
  number: number;
  title: string;
  body: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  stateReason: 'COMPLETED' | 'NOT_PLANNED' | 'REOPENED' | 'DUPLICATE' | null;
  milestone: { number: number } | null;
  labels: Connection<{ name: string }>;
  comments: Connection<{ body: string }>;
  blockedBy: Connection<{ number: number }>;
  duplicateOf: { number: number; repository: { nameWithOwner: string } } | null;
}

interface Connection<T> {
  totalCount: number;
  nodes: T[];
}

/**
 * Everything the pull needs of an issue, in one go: its labels, milestone, comments,
 * blockers and, for a duplicate, `Issue.duplicateOf`. REST's `marked_as_duplicate` timeline
 * event does not name the canonical issue, and GraphQL's `MarkedAsDuplicateEvent` swaps its
 * canonical and duplicate sides, so this reads `Issue.duplicateOf`.
 */
const ISSUE_FIELDS = `fragment question on Issue {
  id databaseId number title body url state stateReason
  milestone { number }
  labels(first: ${PAGE}) { totalCount nodes { name } }
  comments(first: ${PAGE}) { totalCount nodes { body } }
  blockedBy(first: ${PAGE}) { totalCount nodes { number } }
  duplicateOf { number repository { nameWithOwner } }
}`;

const QUESTIONS = `query($owner: String!, $name: String!, $labels: [String!], $after: String) {
  repository(owner: $owner, name: $name) {
    issues(first: ${PAGE}, after: $after, labels: $labels, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes { ...question }
    }
  }
}
${ISSUE_FIELDS}`;

const QUESTION = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issueOrPullRequest(number: $number) { ...question }
  }
}
${ISSUE_FIELDS}`;

const CLOSE_AS_DUPLICATE = `mutation($id: ID!, $of: ID!) {
  closeIssue(input: {issueId: $id, stateReason: DUPLICATE, duplicateIssueId: $of}) { issue { number } }
}`;

/** The `gh` CLI against this repo. */
export function liveGitHub(): GitHub {
  const [owner, name] = SLUG.split('/');
  const ids = new Map<number, IssueIds>();

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

  /** An issue's ids, which never change; from a read when there was one. */
  function known(number: number): IssueIds {
    let found = ids.get(number);
    if (!found) {
      found = JSON.parse(api(['--jq', '{id, node_id}', `repos/${SLUG}/issues/${number}`]));
      ids.set(number, found!);
    }
    return found!;
  }

  /** A connection's nodes, all of them: past the first page, from its REST list. */
  function every<T>(connection: Connection<T>, path: string): T[] {
    return connection.totalCount > connection.nodes.length ? list<T>(path) : connection.nodes;
  }

  function pulled(issue: GraphIssue): PulledQuestion {
    ids.set(issue.number, { id: issue.databaseId, node_id: issue.id });
    const n = issue.number;
    const state = issue.state === 'OPEN' ? 'open' : 'closed';
    const reason = issue.stateReason?.toLowerCase() as PulledQuestion['state_reason'];
    const target = issue.duplicateOf;
    const inRepo = target?.repository.nameWithOwner.toLowerCase() === SLUG.toLowerCase();
    const comments = every(issue.comments, `issues/${n}/comments?per_page=100`);
    return {
      number: n,
      title: issue.title,
      body: issue.body,
      state,
      state_reason: reason ?? null,
      labels: every(issue.labels, `issues/${n}/labels?per_page=100`),
      html_url: issue.url,
      comments: comments.length,
      milestone: issue.milestone,
      blockedBy: every(issue.blockedBy, `issues/${n}/dependencies/blocked_by?per_page=100`),
      issueComments: comments,
      ...(reason === 'duplicate' && { duplicateOf: inRepo ? target!.number : undefined }),
    };
  }

  const blockedBy = (n: number) => `issues/${n}/dependencies/blocked_by`;

  return {
    questions() {
      const found: GraphIssue[] = [];
      let after: string | null = null;
      do {
        type Page = {
          repository: {
            issues: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: GraphIssue[] };
          };
        };
        const page: Page = graphql<Page>(QUESTIONS, { owner, name, labels: KIND_LABELS, after });
        found.push(...page.repository.issues.nodes);
        after = page.repository.issues.pageInfo.hasNextPage
          ? page.repository.issues.pageInfo.endCursor
          : null;
      } while (after);
      return found.map(pulled);
    },
    question(number) {
      type Found = { repository: { issueOrPullRequest: Partial<GraphIssue> | null } };
      const issue = graphql<Found>(QUESTION, { owner, name, number }).repository.issueOrPullRequest;
      // A pull request matches no field of the Issue fragment, so it comes back empty.
      const question = issue?.number === number ? pulled(issue as GraphIssue) : undefined;
      if (!question || !isQuestionIssue(question)) {
        throw new Error(`#${number} is not a question issue`);
      }
      return question;
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
