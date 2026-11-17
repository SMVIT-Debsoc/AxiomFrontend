export const GUIDE_STEPS = [
  {id: "overview", path: "/dashboard", tab: "now", title: "Start on your dashboard",
    text: "Come back to Overview to see your tournament and what to do next."},
  {id: "events", path: "/dashboard/events", title: "Find your tournament",
    text: "Open Events and look for your tournament. View Details opens its schedule and sign-up."},
  {id: "enrollment", path: "/dashboard/events", title: "Join the tournament",
    text: "Tap Enroll Now to join. When you see Enrolled, you’re on the participant list. You’ll still check in separately for each round.",
    fallback: "When your tournament appears, tap View Details, then Enroll Now. Look for Enrolled to confirm."},
  {id: "rounds", path: "/dashboard", tab: "rounds", title: "See your round schedule",
    text: "Under Rounds, tap Open Round to see your check-in times and debate details.",
    fallback: "When the organizers add rounds, they’ll appear here with their check-in times."},
  {id: "check-in", path: "/dashboard", tab: "rounds", round: true, title: "Check in before you debate",
    text: "Check the opening and closing times in IST. Tap Check In Now while the window is open. You’re Checked In confirms the organizers know you’re here.",
    fallback: "Once a round appears here, tap Open Round and look for Check-in Window. Its opening and closing times tell you when you can check in."},
  {id: "side", path: "/dashboard", tab: "rounds", round: true, title: "Find your side and opponent",
    text: "Your Position tells you which side to argue. Government (GOV) supports the topic. Opposition (OPP) argues against it. Your Opponent is listed just below.",
    fallback: "After organizers publish who debates whom, open the round and look for Your Position and Your Opponent."},
  {id: "room", path: "/dashboard", tab: "rounds", round: true, title: "Find your room and debate time",
    text: "Room tells you where to go. Time Slot gives your debate time in IST. That’s separate from the check-in window.",
    fallback: "After organizers assign your room and time, open the round and look for Room and Time Slot."},
  {id: "motion", path: "/dashboard", tab: "rounds", round: true, title: "Find the debate topic",
    text: "The Motion card near the top of the round shows the statement you’ll debate.",
    fallback: "Once organizers release the topic, open the round and look for Motion near the top."},
  {id: "results", path: "/dashboard", tab: "results", title: "See if you advance",
    text: "Check Results after the organizers announce the outcome. Qualified means you advance. If you’re still waiting, come back after the announcement."},
  {id: "profile", path: "/dashboard/profile", title: "Keep your details up to date",
    text: "Use Profile to update details such as your college or phone number. You can replay this walkthrough from Site Tour at any time."},
];

const checkInCopy = {
  present: "You’re Checked In means the organizers have marked you as present for this round.",
  unavailable: "Your check-in status couldn’t load. Tap Retry. Once your status loads, you can check in if the window is still open.",
  upcoming: "Check-in tells the organizers you’re here. Come back at the opening time shown on this card, then tap Check In Now.",
  closed: "The closing time has passed. If you missed check-in, ask an organizer for help.",
  pending: "The organizers haven’t set the check-in times yet. Come back here once they announce the schedule.",
  loading: "We’re checking your attendance status. The check-in button will be ready once your status loads and the window is open.",
};

export function getStepCopy(step, state, targetAvailable) {
  if (step.id === "check-in" && state === "eliminated-example") return "Check-in isn’t available for this round because your tournament run has ended. This example shows where the window and Check In Now appear when you’re eligible.";
  if (step.id === "check-in" && state === "example") return "This example shows where check-in normally appears. Use the opening and closing times on your real card to know when you can check in.";
  if (step.id === "check-in" && Object.hasOwn(checkInCopy, state)) return checkInCopy[state];
  if (step.id === "enrollment" && state === "enrolled") return "Enrolled means you’ve joined this tournament. You’ll still need to check in for each round.";
  if (step.id === "side" && state === "gov") return "You’re Government (GOV) in this round. Your job is to argue for the topic. Your opponent is listed below.";
  if (step.id === "side" && state === "opp") return "You’re Opposition (OPP) in this round. Your job is to argue against the topic. Your opponent is listed below.";
  if (step.id === "side" && state === "unassigned") return "The draw is out. You don’t have a debate assignment this round. Ask an organizer if you expected to be paired.";
  if (step.id === "room" && state === "room-only") return "Room tells you where to go. Your debate time will appear under Time Slot once it’s scheduled.";
  if (step.id === "room" && state === "time-only") return "Time Slot shows when you debate in IST. Look here for your room once it’s assigned.";
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
