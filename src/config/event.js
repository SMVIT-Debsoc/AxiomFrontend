/**
 * Public event details shown on the landing page and the "You're in" screen.
 *
 * Anything in [SQUARE BRACKETS] is a placeholder: replace it with the real value
 * before opening registrations. This is the ONLY file that needs editing for copy
 * about dates, format, prizes and eligibility.
 */
export const EVENT_CONFIG = {
    name: "AXIOM 4.0",
    organiser: "SMVIT Debsoc",
    organiserLong: "SMVIT Debating Society",
    city: "Bengaluru",
    venue: "Sir MVIT, Bengaluru",
    venueShort: "Sir MVIT",

    // Placeholders to fill in
    registrationCloses: "[DATE]",
    dates: "[DATES]",
    format: "[FORMAT]",
    prizePool: "[₹ AMOUNT]",
    prelimRounds: "[N]",
    breakRounds: "[N]",
    bestSpeakerPrize: "[₹ X]",
    entryFee: "Free",
    entryFeeNote: "Entry · [OR YOUR FEE]",
    regionLabel: "[CITY / REGION]",
    judgePanel: "[JUDGE PANEL DETAIL]",
    round1CheckIn: "[TIME]",
    eligibility: "[ELIGIBILITY — e.g. any enrolled college student]",
};

export const isPlaceholder = (value) => typeof value === "string" && /\[[^\]]+\]/.test(value);

// Quick-pick chips on the complete-profile screen. Edit to match your likely colleges.
export const COLLEGE_SUGGESTIONS = ["Sir MVIT", "RVCE", "BMSCE", "PES University"];
