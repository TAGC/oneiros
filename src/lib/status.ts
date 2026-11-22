/** Page statuses, least to most settled. They reuse the four belief stage names and the Musing state's name but are about the wiki. */
export const STATUSES = ['Notion', 'Musing', 'Tenet', 'Certainty', 'Dogma'] as const;
export type Status = (typeof STATUSES)[number];
