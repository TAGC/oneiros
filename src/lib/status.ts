/** Page statuses, least to most settled. They reuse the belief stage names but are about the wiki. */
export const STATUSES = ['Hearsay', 'Notion', 'Tenet', 'Creed', 'Dogma'] as const;
export type Status = (typeof STATUSES)[number];
