// "Do this next" for the Director, from round state. Pure; tested in tests/liveStations.test.mjs.

export const PIPELINE = ["Check-in", "Draw", "Rooms", "Publish", "Ballots", "Advance"];

/**
 * The single "Do this next" action, from round state (same rules as the old
 * Live page). `actions` supplies the handlers.
 */
export function nextStep({step, present, total, debates, withRoom, noJudge, pending, resultsPublished, isRound1, busy, actions}) {
    if (step === 0) return {
        title: "Close check-in & draw",
        body: `${present} of ${total} debaters are present. Closing check-in locks the list and generates the ${isRound1 ? "random" : "power-matched"} draw.`,
        cta: "Close check-in → draw", run: actions.generate, working: busy === "generating", disabled: present === 0,
    };
    if (step === 1) return {
        title: "Allocate rooms",
        body: `${debates} debates drafted. Review the draw, then allocate rooms.`,
        cta: "Allocate rooms", run: () => actions.allocate("all"), working: busy === "allocating",
    };
    if (step === 2) return {
        title: "Finish room allocation",
        body: `${withRoom} of ${debates} debates have a room. Allocate the rest to continue.`,
        cta: "Finish allocation", run: () => actions.allocate("unassigned"), working: busy === "allocating",
    };
    if (step === 3) return {
        title: "Publish the draw",
        body: `Debaters get their room, side and opponent instantly.${noJudge ? ` ${noJudge} debate${noJudge === 1 ? "" : "s"} still need a judge; you can assign later.` : ""}`,
        cta: "Publish draw", run: actions.publish, working: busy === "publishing",
    };
    if (step === 4) return {
        title: "Collect ballots",
        body: `${pending} ballot${pending === 1 ? "" : "s"} outstanding. Judges submit e-ballots; enter paper ones here.`,
        cta: "Enter next ballot", run: actions.nextBallot,
    };
    return {
        title: resultsPublished ? "Advance debaters" : "Publish results",
        body: resultsPublished ? "Results are public. Set the cut line and advance best losers." : "All ballots are in. Make results public, then advance.",
        cta: resultsPublished ? "Open Advance" : "Publish results",
        run: resultsPublished ? actions.advance : actions.publishResults,
        working: busy === "results",
    };
}
