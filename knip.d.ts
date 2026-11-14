/**
 * Shared Knip policy: configuration and tag hints are unresolved questions, so a run that reports
 * them fails. Spread into the consumer's own knip configuration; `entry`, `project`, `paths`,
 * `workspaces`, ignores and plugin paths stay in the consumer. Plain data — no runtime Knip import,
 * no fix behaviour, and no `extends`: consumers compose with ordinary object spread.
 */
export declare const knip: {
  treatConfigHintsAsErrors: boolean;
  treatTagHintsAsErrors: boolean;
};
