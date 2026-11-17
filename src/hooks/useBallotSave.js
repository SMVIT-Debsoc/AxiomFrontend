import {useEffect, useRef, useState} from "react";
import {useAuth} from "../auth/client.jsx";
import {AdminApi, DebateApi} from "../services/api";

const SAVE_TIMEOUT_MS = 12000;
const VERIFY_TIMEOUT_MS = 8000;

export function useBallotSave(onConfirmed) {
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
    try {
      await action(AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)]), isCurrent);
    } finally {
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
      const {debateId, nextDebate, ...scores} = ballot;
      let response;
      let requestStarted = false;
      try {
        const token = await getToken();
        if (!isCurrent()) return;
        signal.throwIfAborted();
        requestStarted = true;
        response = await AdminApi.submitResult(debateId, scores, token, {summary: true, signal});
      } catch (error) {
        if (!isCurrent()) return;
        const status = error?.status;
        if (!requestStarted || (status >= 400 && status < 500 && status !== 408 && status !== 409)) {
          setSaveError(error?.message || "Could not start the ballot save.");
        } else {
          pendingBallot.current = ballot;
          setRecovery({kind: "unconfirmed"});
        }
        return;
      }
      if (isCurrent()) onConfirmed({...scores, debateId, nextDebate}, response.debate);
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
        setRecovery({kind: "different", saved});
      }
    });
  }

  return {save, verify, busy, recovery, saveError, clearSaveError: () => setSaveError(null)};
}
