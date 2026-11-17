import {useEffect, useMemo, useRef, useState} from "react";
import socketService, {PRESENCE_HEARTBEAT_MS, SocketEvents} from "../services/socket";
import {CLIENT_ID} from "../services/api";
import {useUser} from "../auth/client.jsx";

// Announces this admin (station + focus) to the round and returns who else is here.
//
//   const {admins, me} = usePresence({eventId, roundId, station, focus});
//   admins: [{clientId, actorId, name, station: "director"|"desk"|"results"|"display", focus: {kind:"debate"|"room"|"panel", id} | null, at}]
//   (excludes this tab; `me` is this tab's own entry)
//
// focus is a soft lock: other admins see "Riya is scoring Room 12" but are never blocked.
// No-op (and empty result) when roundId is missing.

function useAdminDisplayName() {
  const {user} = useUser();
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Organiser";
}

export function usePresence({eventId, roundId, station, focus} = {}) {
  const name = useAdminDisplayName();
  const [state, setState] = useState({roundId: null, admins: []});
  const focusKind = focus?.kind ?? null;
  const focusId = focus?.id ?? null;
  const focusLabel = typeof focus?.label === "string" && focus.label.trim() ? focus.label.trim().slice(0, 60) : null;

  const payload = useMemo(
    () => (roundId ? {
      eventId: eventId || null,
      roundId,
      station: station || null,
      focus: focusKind && focusId != null ? {kind: focusKind, id: String(focusId), ...(focusLabel ? {label: focusLabel} : {})} : null,
      name,
      clientId: CLIENT_ID,
    } : null),
    [eventId, roundId, station, focusKind, focusId, focusLabel, name],
  );
  const payloadRef = useRef(payload);
  useEffect(() => { payloadRef.current = payload; }, [payload]);

  // Join the round room so PRESENCE_STATE reaches this tab.
  useEffect(() => {
    if (!roundId) return undefined;
    socketService.joinRound(roundId);
    return () => socketService.leaveRound(roundId);
  }, [roundId]);

  // Announce on change, heartbeat, and re-announce after every reconnect.
  useEffect(() => {
    if (!payload) return undefined;
    socketService.emitPresence(payload);
    const timer = window.setInterval(() => socketService.emitPresence(payloadRef.current), PRESENCE_HEARTBEAT_MS);
    const offConnect = socketService.on(SocketEvents.CONNECTION, () => socketService.emitPresence(payloadRef.current));
    return () => {
      window.clearInterval(timer);
      offConnect();
    };
  }, [payload]);

  useEffect(() => {
    if (!roundId) return undefined;
    return socketService.on(SocketEvents.PRESENCE_STATE, (data) => {
      if (!data || String(data.roundId) !== String(roundId)) return;
      setState({roundId: data.roundId, admins: Array.isArray(data.admins) ? data.admins : []});
    });
  }, [roundId]);

  return useMemo(() => {
    if (!roundId) return {admins: [], me: null};
    const list = String(state.roundId) === String(roundId) ? state.admins : [];
    const others = list.filter((a) => a && a.clientId !== CLIENT_ID);
    const serverMe = list.find((a) => a && a.clientId === CLIENT_ID);
    const me = serverMe || (payload ? {...payload, actorId: null, at: null} : null);
    return {admins: others, me};
  }, [roundId, state, payload]);
}

// Helper: who (other than me) is focused on an entity.
export function othersFocusedOn(admins, kind, id) {
  return (admins || []).filter((a) => a.focus?.kind === kind && String(a.focus?.id) === String(id));
}

export const STATION_NAMES = {director: "Director", desk: "Desk", results: "Results", display: "Display"};

/** "Riya · Desk · scoring Room 12" — the tooltip line for one admin. */
export function describePresence(admin) {
  if (!admin) return "";
  const parts = [admin.name || "Organiser"];
  if (admin.station) parts.push(STATION_NAMES[admin.station] || admin.station);
  const focus = admin.focus;
  if (focus && focus.id != null) {
    const label = focus.label || (focus.kind === "room" ? "a room" : focus.kind === "panel" ? `the ${focus.id} panel` : "a debate");
    parts.push(`${focus.kind === "panel" ? "on" : "scoring"} ${label}`);
  }
  return parts.join(" · ");
}
