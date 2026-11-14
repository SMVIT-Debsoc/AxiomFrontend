/**
 * Resolves the winner ID based on scores.
 * Higher score automatically gets the winner tag.
 * On an exact tie, returns the manual choice if valid, or empty string to require selection.
 */
export function resolveWinnerId(score1, score2, currentWinnerId, debater1Id, debater2Id) {
    const s1 = parseFloat(score1);
    const s2 = parseFloat(score2);
    if (Number.isFinite(s1) && Number.isFinite(s2)) {
        if (s1 > s2) return debater1Id;
        if (s2 > s1) return debater2Id;
        if (currentWinnerId === debater1Id || currentWinnerId === debater2Id) {
            return currentWinnerId;
        }
        return "";
    }
    return currentWinnerId || "";
}
