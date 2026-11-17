export const GUIDE_STEPS = [
  {id: "overview", path: "/dashboard", tab: "now", title: "Start on your dashboard",
    text: "Come back to Overview to see your tournament and what to do next."},
  {id: "events", path: "/dashboard/events", title: "Find your tournament",
    text: "Open Events and look for your tournament. View Details opens its schedule and sign-up."},
  {id: "enrollment", path: "/dashboard/events", title: "Join the tournament",
    text: "Tap Enroll Now to join. When you see Enrolled, you’re on the participant list. You’ll still check in separately for each round.",
    fallback: "When your tournament appears, tap View Details, then Enroll Now. Look for Enrolled to confirm."},
  {id: "check-in", path: "/dashboard", tab: "now", title: "Check in before you debate",
    text: "Check-in tells the organizers you’re here for this round. Tap Check In Now before the closing time. Look for Presence Verified afterward.",
    fallback: "When a round is available, its check-in times appear under Live Matchup. Check in during those times to tell the organizers you’re here."},
  {id: "matchup", path: "/dashboard", tab: "now", title: "Find your debate",
    text: "Find your room and the topic (called the motion). GOV argues for the motion. OPP argues against it. Tap View Round Draw & Details for more.",
    fallback: "When the organizers publish who debates whom, look here for your room, side, and topic."},
  {id: "rounds", path: "/dashboard", tab: "rounds", title: "See your round schedule",
    text: "Tap Open Round for its check-in times and debate details. You can also revisit earlier rounds here.",
    fallback: "When the organizers add rounds, they’ll appear here with their check-in times."},
  {id: "results", path: "/dashboard", tab: "results", title: "See if you advance",
    text: "Check Results after the organizers announce the outcome. Qualified means you advance. If you’re still waiting, come back after the announcement."},
  {id: "profile", path: "/dashboard/profile", title: "Keep your details up to date",
    text: "Use Profile to update details such as your college or phone number. You can replay this walkthrough from Site Tour at any time."},
];

const checkInCopy = {
  present: "Presence Verified means the organizers have marked you as here for this round.",
  unavailable: "Your check-in status couldn’t load. Tap Retry. Once your status loads, you can check in if the window is still open.",
  upcoming: "Check-in tells the organizers you’re here. Come back at the opening time shown on this card, then tap Check In Now.",
  closed: "The closing time has passed. If you missed check-in, ask an organizer for help.",
  pending: "The organizers haven’t set the check-in times yet. Come back here once they announce the schedule.",
  loading: "We’re checking your attendance status. The check-in button will be ready once your status loads and the window is open.",
};

export function getStepCopy(step, state, targetAvailable) {
  if (step.id === "check-in" && Object.hasOwn(checkInCopy, state)) return checkInCopy[state];
  if (step.id === "enrollment" && state === "enrolled") return "Enrolled means you’ve joined this tournament. You’ll still need to check in for each round.";
  if (step.id === "matchup" && state === "unassigned") return "The draw is out. You don’t have a debate assignment this round. Ask an organizer if you expected to be paired.";
  if (step.id === "results" && state === "waiting") return "Results aren’t out yet. Come back here after the organizers announce them. Qualified means you advance to the next round.";
  return targetAvailable ? step.text : step.fallback || step.text;
}

const storageKey = (userId) => `axiom.site-tour.v1.${userId}`;

export function readTourProgress(userId, storage) {
  try {
    const saved = (storage ?? window.localStorage).getItem(storageKey(userId));
    if (saved === "dismissed" || saved === "finished" || GUIDE_STEPS.some(({id}) => id === saved)) return saved;
  } catch {
    // The tour is still available when storage is restricted.
  }
  return null;
}

export function writeTourProgress(userId, progress, storage) {
  try {
    (storage ?? window.localStorage).setItem(storageKey(userId), progress);
  } catch {
    // Keep working with the progress held in memory.
  }
}
