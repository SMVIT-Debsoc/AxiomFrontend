import {useEffect, useRef, useState} from "react";
import {useAuth} from "../auth/client.jsx";
import {AdminApi, DebateApi} from "../services/api";
import {createRequestSignal} from "../lib/requestSignal.js";

const SAVE_TIMEOUT_MS = 12000;
const VERIFY_TIMEOUT_MS = 8000;

/**
 * Ballot save with recovery for flaky networks and concurrent admins.
 *
 * Ballots may carry `expectedUpdatedAt` (the debate.updatedAt the admin loaded).
 * The server answers 409 when someone else saved in between:
 *  - BALLOT_CONFLICT → recovery {kind: "different", conflict: true, saved: server's current debate}
 *  - DEBATE_REPLACED → the debate was deleted by re-pairing; onReplaced(error) is called
 *
 * After an unconfirmed save, verify() reads the stored ballot. When it differs
 * from this admin's entry, onRebase(saved) hands the sheet the server's debate
 * (with its updatedAt) so the next save is based on it instead of the stale
 * version, which would otherwise come back as a self-inflicted BALLOT_CONFLICT.
 */
export function useBallotSave(onConfirmed, {onReplaced, onRebase} = {}) {
  const {getToken} = useAuth();
  const operation = useRef(null);
  const pendingBallot = useRef(null);
  const [busy, setBusy] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => () => {
    operation.current?.abort();
    operation.current = null;
  }, []);

  async function run(kind, timeout, action) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(kind);
    const isCurrent = () => operation.current === controller;
    const request = createRequestSignal(timeout, controller.signal);
    try {
      await action(request.signal, isCurrent);
    } finally {
      request.dispose?.();
      if (isCurrent()) {
        operation.current = null;
        setBusy(null);
      }
    }
  }

  async function save(ballot) {
    if (pendingBallot.current) return;
    await run("save", SAVE_TIMEOUT_MS, async (signal, isCurrent) => {
      setSaveError(null);
      setRecovery(null);
      const {debateId, nextDebate, ...payload} = ballot;
      const {expectedUpdatedAt, ...scores} = payload;
      let response;
      let requestStarted = false;
      try {
        const token = await getToken();
        if (!isCurrent()) return;
        if (signal.aborted) {
          throw signal.reason ?? new DOMException("The request was cancelled.", "AbortError");
        }
        requestStarted = true;
        // Older backends ignore expectedUpdatedAt; omit it when unknown.
        const body = expectedUpdatedAt ? {...scores, expectedUpdatedAt} : scores;
        response = await AdminApi.submitResult(debateId, body, token, {summary: true, signal});
      } catch (error) {
        if (!isCurrent()) return;
        const status = error?.status;
        if (status === 409 && error?.code === "BALLOT_CONFLICT") {
          setRecovery({kind: "different", conflict: true, saved: error.data?.current || null});
          return;
        }
        if (status === 409 && error?.code === "DEBATE_REPLACED") {
          setSaveError(error.message || "This debate was replaced by new pairings.");
          onReplaced?.(error);
          return;
        }
        if (!requestStarted || (status >= 400 && status < 500 && status !== 408 && status !== 409)) {
          setSaveError(error?.message || "Could not start the ballot save.");
        } else {
          pendingBallot.current = ballot;
          setRecovery({kind: "unconfirmed"});
        }
        return;
      }
      if (isCurrent()) {
        const saved = response.debate || (response.updatedAt ? {updatedAt: response.updatedAt} : undefined);
        onConfirmed({...scores, debateId, nextDebate}, saved);
      }
    });
  }

  async function verify() {
    const ballot = pendingBallot.current;
    if (!ballot) return;
    await run("verify", VERIFY_TIMEOUT_MS, async (signal, isCurrent) => {
      let saved;
      try {
        const token = await getToken();
        if (!isCurrent()) return;
        const response = await DebateApi.getSavedBallot(ballot.debateId, token, signal);
        saved = response.debate;
        if (!saved) throw new Error("Ballot response missing");
      } catch {
        if (isCurrent()) setRecovery({kind: "unconfirmed", verifyFailed: true});
        return;
      }
      if (!isCurrent()) return;
      pendingBallot.current = null;
      if (saved.status === "COMPLETED" &&
          saved.debater1Score === ballot.debater1Score &&
          saved.debater2Score === ballot.debater2Score &&
          saved.winnerId === ballot.winnerId) {
        setRecovery(null);
        onConfirmed(ballot, saved);
      } else {
        onRebase?.(saved);
        setRecovery({kind: "different", saved});
      }
    });
  }

  return {
    save,
    verify,
    busy,
    recovery,
    saveError,
    clearSaveError: () => setSaveError(null),
    clearRecovery: () => {
      pendingBallot.current = null;
      setRecovery(null);
    },
  };
}
