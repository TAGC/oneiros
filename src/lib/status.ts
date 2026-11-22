/** Page statuses, least to most settled: the four belief stages, used for the wiki's own beliefs about the design. */
export const STATUSES = ['Notion', 'Tenet', 'Certainty', 'Dogma'] as const;
export type Status = (typeof STATUSES)[number];
