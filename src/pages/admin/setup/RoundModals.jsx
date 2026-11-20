import { useState } from "react";
import { motion as Motion } from "framer-motion";
import { X } from "lucide-react";
import ModalSurface from "../../../components/ui/ModalSurface";
import { useAuth } from "../../../auth/client.jsx";
import { AdminApi } from "../../../services/api";
import { useAdminMutation } from "../../../hooks/useAdminMutation";
import { useDirtyGuard } from "../../../hooks/useDirtyGuard";
import { cn, addMinutesToISTDateTime, toISTISOString, toISTDateTimeLocal, getCurrentISTDateTimeLocal } from "../../../lib/utils";
import AdvanceTargetField from "./AdvanceTargetField";
import { advanceTargetError, advanceTargetToPayload, advanceTargetToForm } from "../../../lib/advanceTarget";

// The one create-round and one edit-round dialog (Setup → Rounds).

export function CreateRoundModal({ eventId, roundNumber, onClose, onCreated }) {
  const { getToken } = useAuth();
  const { run, isBusy } = useAdminMutation();
  const loading = isBusy("create-round");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState(() => ({
    eventId,
    roundNumber,
    name: `Preliminary Round ${roundNumber}`,
    motion: "",
    checkInStartTime: getCurrentISTDateTimeLocal(),
    checkInEndTime: toISTDateTimeLocal(new Date(Date.now() + 20 * 60000)),
    status: "UPCOMING",
    advanceTarget: "",
  }));
  const [dirty, setDirty] = useState(false);
  const confirmDiscard = useDirtyGuard(dirty);
  const updateForm = (patch) => {
    setDirty(true);
    setFormData((prev) => ({ ...prev, ...patch }));
  };
  const handleClose = () => {
    if (confirmDiscard()) onClose();
  };

  // A new round's window is measured from its chosen start time.
  const applyDurationPreset = (minutes) => {
    const base = formData.checkInStartTime || getCurrentISTDateTimeLocal();
    updateForm({ checkInStartTime: base, checkInEndTime: addMinutesToISTDateTime(base, minutes) });
    setError("");
  };

  const currentDurationMins = (() => {
    if (!formData.checkInStartTime || !formData.checkInEndTime) return null;
    const startMs = new Date(formData.checkInStartTime).getTime();
    const endMs = new Date(formData.checkInEndTime).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
    return Math.round((endMs - startMs) / 60000);
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.motion?.trim()) {
      setError("Debate motion is required and cannot be empty.");
      return;
    }

    const startIso = toISTISOString(formData.checkInStartTime);
    const endIso = toISTISOString(formData.checkInEndTime);
    if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
      setError("Check-in end time must be after check-in start time.");
      return;
    }
    const targetError = advanceTargetError(formData.advanceTarget);
    if (targetError) {
      setError(targetError);
      return;
    }
    const { advanceTarget, ...rest } = formData;
    const advance = advanceTargetToPayload(advanceTarget);

    await run(
      "create-round",
      async () => {
        const token = await getToken();
        return AdminApi.createRound(
          { ...rest, ...(advance != null ? { advanceTarget: advance } : {}), motion: formData.motion.trim(), checkInStartTime: startIso, checkInEndTime: endIso },
          token
        );
      },
      {
        success: `${formData.name || "Round"} created`,
        onSuccess: () => {
          setDirty(false);
          onCreated();
        },
        onError: (err) => setError(err?.message || "Could not create round"),
      }
    );
  };

  return (
    <ModalSurface onDismiss={handleClose} aria-label={`Create Round ${roundNumber}`}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><Motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl"
    >
      <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground">Create Round {roundNumber}</h2>
          <p className="text-xs text-muted-foreground font-sans">Set check-in timeline (20m default IST) and debate motion</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
        {error && (
          <div className="ax-signal-loss rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-700 dark:text-rose-200 font-medium" role="alert">
            {error}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <label className="md:col-span-2"><span className="text-xs font-semibold mb-1 block text-foreground">Round Name</span><input type="text"
          required
          value={formData.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
          <label className="md:col-span-2"><span className="text-xs font-semibold mb-1 block text-foreground">
            Debate Motion *
          </span><textarea value={formData.motion}
          required
          onChange={(e) => updateForm({ motion: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
          rows={3}
          placeholder="This house believes that... (Required)" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in Start (IST)</span><input type="datetime-local"
          required
          value={formData.checkInStartTime}
          onChange={(e) =>
            updateForm({ checkInStartTime: e.target.value })
          }
          className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in End (IST)</span><input type="datetime-local"
          required
          value={formData.checkInEndTime}
          onChange={(e) =>
            updateForm({ checkInEndTime: e.target.value })
          }
          className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Window length:</span>
            {[15, 20, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => applyDurationPreset(mins)}
                className="min-h-11 px-3.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-bold text-foreground transition-colors"
              >
                {mins}m
              </button>
            ))}
          </div>
          <div className="md:col-span-2">
            <AdvanceTargetField value={formData.advanceTarget} onChange={(advanceTarget) => updateForm({ advanceTarget })} />
          </div>
        </div>
        <div className="flex gap-2.5 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 min-h-11 py-2 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 min-h-11 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 text-xs"
          >
            {loading ? "Creating..." : "Create Round"}
          </button>
        </div>
      </form>
    </Motion.div></ModalSurface>
  );
}


const ROUND_EDIT_FIELDS = ["name", "motion", "checkInStartTime", "checkInEndTime", "status", "pairingsPublished", "advanceTarget"];
const ROUND_FIELD_LABELS = {
  name: "name",
  motion: "motion",
  checkInStartTime: "check-in start",
  checkInEndTime: "check-in end",
  status: "status",
  pairingsPublished: "draw visibility",
  advanceTarget: "advance target",
};

function roundToForm(round) {
  return {
    name: round?.name || "",
    motion: round?.motion || "",
    checkInStartTime: toISTDateTimeLocal(round?.checkInStartTime),
    checkInEndTime: toISTDateTimeLocal(round?.checkInEndTime),
    status: round?.status || "UPCOMING",
    pairingsPublished: Boolean(round?.pairingsPublished),
    advanceTarget: advanceTargetToForm(round?.advanceTarget),
  };
}

export function EditRoundModal({ round, latestRound, remoteChanges = 0, onClose, onUpdated }) {
  const { getToken } = useAuth();
  const { run, isBusy } = useAdminMutation();
  const loading = isBusy("update-round");
  const [error, setError] = useState("");

  // Snapshot of the values the admin started from. Only fields that differ
  // from it are sent, so a draw publish or status change made by another
  // admin while this modal is open is never silently reverted.
  const [initialForm, setInitialForm] = useState(() => roundToForm(round));
  const [formData, setFormData] = useState(initialForm);
  const changedFields = ROUND_EDIT_FIELDS.filter((key) => formData[key] !== initialForm[key]);
  const confirmDiscard = useDirtyGuard(changedFields.length > 0);
  const handleClose = () => {
    if (confirmDiscard()) onClose();
  };

  const serverForm = latestRound ? roundToForm(latestRound) : null;
  const remoteDiff = serverForm ? ROUND_EDIT_FIELDS.filter((key) => serverForm[key] !== initialForm[key]) : [];
  const deletedUnderneath = !loading && remoteChanges > 0 && !latestRound;
  const changedUnderneath = !loading && (remoteDiff.length > 0 || deletedUnderneath);

  const reviewLatest = () => {
    if (!serverForm) return;
    // Keep the admin's own edits; take everything else from the server.
    setFormData((prev) => {
      const next = { ...serverForm };
      changedFields.forEach((key) => { next[key] = prev[key]; });
      return next;
    });
    setInitialForm(serverForm);
  };

  // Presets on an existing round open the window from now (re-opening check-in).
  const applyWindowPreset = (minutes) => {
    const now = getCurrentISTDateTimeLocal();
    setFormData((prev) => ({
      ...prev,
      checkInStartTime: now,
      checkInEndTime: addMinutesToISTDateTime(now, minutes),
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (changedFields.length === 0) {
      onClose();
      return;
    }

    const payload = {};
    for (const key of changedFields) payload[key] = formData[key];
    if ("motion" in payload) payload.motion = payload.motion.trim();
    if ("advanceTarget" in payload) {
      const targetError = advanceTargetError(formData.advanceTarget);
      if (targetError) {
        setError(targetError);
        return;
      }
      // null = auto (smallest power of two that holds every winner)
      payload.advanceTarget = advanceTargetToPayload(formData.advanceTarget);
    }

    if ("checkInStartTime" in payload || "checkInEndTime" in payload) {
      const startIso = toISTISOString(formData.checkInStartTime);
      const endIso = toISTISOString(formData.checkInEndTime);
      if (!startIso || !endIso || new Date(endIso) <= new Date(startIso)) {
        setError("Check-in end time must be after check-in start time.");
        return;
      }
      if ("checkInStartTime" in payload) payload.checkInStartTime = startIso;
      if ("checkInEndTime" in payload) payload.checkInEndTime = endIso;
    }

    await run(
      "update-round",
      async () => {
        const token = await getToken();
        return AdminApi.updateRound(round.id, payload, token);
      },
      {
        success: "Round updated",
        onSuccess: () => onUpdated(),
        onError: (err) => setError(err?.message || "Could not update round"),
      }
    );
  };

  return (
    <ModalSurface onDismiss={handleClose} aria-label="Edit Round"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-foreground"><Motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border/80 rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl"
    >
      <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-foreground">Edit Round Parameters</h2>
          <p className="text-xs text-muted-foreground font-sans">Update schedule, motion, and draw visibility</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
        {changedUnderneath && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200" role="status">
            <span className="font-medium">
              {deletedUnderneath
                ? "This round was deleted by another admin."
                : "Updated by another admin — review before saving."}
              {remoteDiff.length > 0 && !deletedUnderneath && (
                <span className="font-normal"> Changed: {remoteDiff.map((key) => ROUND_FIELD_LABELS[key]).join(", ")}.</span>
              )}
            </span>
            {serverForm && remoteDiff.length > 0 && (
              <button
                type="button"
                onClick={reviewLatest}
                className="min-h-9 rounded-md border border-amber-500/40 px-2.5 font-semibold hover:bg-amber-500/15"
              >
                Load latest values
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="ax-signal-loss rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-700 dark:text-rose-200 font-medium" role="alert">
            {error}
          </div>
        )}
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Round Name</span><input type="text"
        required
        value={formData.name}
        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
        className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" /></label>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Debate Motion</span><textarea value={formData.motion}
        onChange={(e) => setFormData((prev) => ({ ...prev, motion: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
        rows={3}
        placeholder="This house believes that..." /></label>
    
        <div className="grid md:grid-cols-2 gap-3">
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in Start (IST)</span><input type="datetime-local"
          value={formData.checkInStartTime}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, checkInStartTime: e.target.value }))
          }
          className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
          <label ><span className="text-xs font-semibold mb-1 block text-foreground">Check-in End (IST)</span><input type="datetime-local"
          value={formData.checkInEndTime}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, checkInEndTime: e.target.value }))
          }
          className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all" /></label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Open window from now:</span>
          {[15, 20, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => applyWindowPreset(mins)}
              className="min-h-11 px-3.5 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-bold text-foreground transition-colors"
            >
              {mins}m
            </button>
          ))}
        </div>
    
        <label ><span className="text-xs font-semibold mb-1 block text-foreground">Status</span><select value={formData.status}
        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
        className="w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-xs transition-all"><option value="UPCOMING">Upcoming</option>
        <option value="ONGOING">Ongoing</option>
        <option value="COMPLETED">Completed</option></select></label>
    
        <AdvanceTargetField value={formData.advanceTarget} onChange={(advanceTarget) => setFormData((prev) => ({ ...prev, advanceTarget }))} />

        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-muted/40 border border-border/70">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            id="pairingsPublished"
            checked={formData.pairingsPublished}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, pairingsPublished: e.target.checked }))
            }
          />
          <label htmlFor="pairingsPublished" className="text-xs font-medium cursor-pointer text-foreground">
            Publish Draw (Makes matchups and room allocations visible to debaters)
          </label>
        </div>
    
        <div className="flex gap-2.5 pt-4 border-t border-border/60 mt-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 min-h-11 py-2 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 min-h-11 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 text-xs"
          >
            {loading ? "Updating..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Motion.div></ModalSurface>
  );
}
