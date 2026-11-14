export const VISUAL_GUIDE_STORAGE_KEY = "axiom_visual_guide_seen";

export const GUIDE_STEPS = [
  {
    id: "check-in",
    numeral: "01",
    badge: "Lock In",
    title: "Check In Before the Draw",
    catchphrase: "No check-in, no mic.",
    instruction:
      "Tap Check In Now on the Live Matchup tab as soon as the window opens so the pairings engine seats you.",
    destination: "Live Matchup tab -> Check-In Card",
  },
  {
    id: "arena",
    numeral: "02",
    badge: "Find Your Bench",
    title: "Spot Room, Side & Motion",
    catchphrase: "GOV opens. OPP claps back.",
    instruction:
      "Once the draw goes public, your Room, GOV or OPP side, and Round Motion light up right on your home card and Rounds tab.",
    destination: "Live Matchup or Rounds tab",
  },
  {
    id: "live",
    numeral: "03",
    badge: "Live Telemetry",
    title: "Ride the Live Wire",
    catchphrase: "Blink and the draw drops.",
    instruction:
      "Switch between Live Matchup, Rounds, and Results or tap Events in the nav bar—draws and announcements stream live with zero refresh.",
    destination: "Top Tabs & Nav Dock",
  },
  {
    id: "results",
    numeral: "04",
    badge: "Check the Gavel",
    title: "Follow Advancement",
    catchphrase: "Scores stay backstage. Qualification hits the stage.",
    instruction:
      "Open Results once judges finalize ballots to see your QUALIFIED or ELIMINATED status and official tournament standings.",
    destination: "Results tab -> Standings",
  },
];

export function isGuideDismissed(storage = typeof window !== "undefined" ? window.localStorage : null) {
  if (!storage) return false;
  try {
    return storage.getItem(VISUAL_GUIDE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markGuideDismissed(storage = typeof window !== "undefined" ? window.localStorage : null) {
  if (!storage) return;
  try {
    storage.setItem(VISUAL_GUIDE_STORAGE_KEY, "true");
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function resetGuideDismissed(storage = typeof window !== "undefined" ? window.localStorage : null) {
  if (!storage) return;
  try {
    storage.removeItem(VISUAL_GUIDE_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted environments
  }
}
