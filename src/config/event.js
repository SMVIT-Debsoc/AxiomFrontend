/**
 * Public event details shown across the site.
 *
 * This holds real brand and venue information for AXIOM 4.0.
 */
export const EVENT_CONFIG = {
    name: "AXIOM 4.0",
    organiser: "SMVIT Debsoc",
    organiserLong: "SMVIT Debating Society",
    city: "Bengaluru",
    venue: "Sir MVIT, Bengaluru",
    venueShort: "Sir MVIT",
};

export const isPlaceholder = (value) => typeof value === "string" && /\[[^\]]+\]/.test(value);

// Quick-pick chips on the complete-profile screen.
export const COLLEGE_SUGGESTIONS = ["Sir MVIT", "RVCE", "BMSCE", "PES University"];
