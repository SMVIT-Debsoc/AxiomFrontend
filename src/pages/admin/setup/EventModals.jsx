import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import ModalSurface from "../../../components/ui/ModalSurface";
import { useAuth } from "../../../auth/client.jsx";
import { AdminApi } from "../../../services/api";
import { useAdminMutation } from "../../../hooks/useAdminMutation";
import { useDirtyGuard } from "../../../hooks/useDirtyGuard";
import { serializeEventDates, toLocalDateTime } from "../../../lib/datetime";

const inputClass =
  "w-full min-h-11 px-3 py-2 rounded-lg bg-background border border-border/70 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-base sm:text-sm";

function toForm(event) {
  return {
    name: event?.name || "",
    description: event?.description || "",
    startDate: event?.startDate ? toLocalDateTime(event.startDate) : "",
    endDate: event?.endDate ? toLocalDateTime(event.endDate) : "",
    status: event?.status || "UPCOMING",
    whatsappLink: event?.whatsappLink || "",
  };
}

/**
 * The one create / edit event dialog (Setup → Events and Setup → Rounds header).
 * Pass `event` to edit; omit it to create. `onSaved(response)` runs after success.
 */
export default function EventFormModal({ event = null, onClose, onSaved }) {
  const editing = Boolean(event?.id);
  const { getToken } = useAuth();
  const { run, isBusy } = useAdminMutation();
  const busy = isBusy("save-event");
  const [error, setError] = useState("");
  const [initial] = useState(() => toForm(event));
  const [formData, setFormData] = useState(initial);
  const dirty = Object.keys(initial).some((key) => initial[key] !== formData[key]);
  const confirmDiscard = useDirtyGuard(dirty);
  const handleClose = () => {
    if (confirmDiscard()) onClose();
  };
  const set = (patch) => {
    setError("");
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      whatsappLink: formData.whatsappLink.trim(),
    };
    if (!trimmed.name) {
      setError("Give the event a name.");
      return;
    }
    if (trimmed.endDate && trimmed.startDate && new Date(trimmed.endDate) < new Date(trimmed.startDate)) {
      setError("The end date must be after the start date.");
      return;
    }
    const { status, ...createFields } = trimmed;
    await run(
      "save-event",
      async () => {
        const token = await getToken();
        return editing
          ? AdminApi.updateEvent(event.id, serializeEventDates(trimmed, event), token)
          : AdminApi.createEvent(serializeEventDates({ ...createFields, ...(status !== "UPCOMING" ? { status } : {}) }), token);
      },
      {
        success: editing ? "Event saved" : "Event created",
        onSuccess: (response) => onSaved?.(response),
        onError: (err) => setError(err?.message || (editing ? "Could not save the event" : "Could not create the event")),
      },
    );
  };

  const title = editing ? "Edit event" : "New event";

  return (
    <ModalSurface
      onDismiss={handleClose}
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-foreground"
    >
      <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">{title}</h2>
            <p className="m-0 text-xs text-muted-foreground">{editing ? "Change details or status" : "Name, dates and the WhatsApp group"}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {error && (
            <div role="alert" className="ax-state-flag rounded-lg border px-3 py-2 text-xs font-medium">
              {error}
            </div>
          )}
          <label className="block">
            <span className="text-xs font-semibold mb-1 block text-foreground">Event name</span>
            <input type="text" required value={formData.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} placeholder="Axiom 4.0" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold mb-1 block text-foreground">Description</span>
            <textarea value={formData.description} onChange={(e) => set({ description: e.target.value })} className={`${inputClass} resize-none`} rows={3} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold mb-1 block text-foreground">Start (local time)</span>
              <input type="datetime-local" required value={formData.startDate} onChange={(e) => set({ startDate: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold mb-1 block text-foreground">End (local time)</span>
              <input type="datetime-local" value={formData.endDate} onChange={(e) => set({ endDate: e.target.value })} className={inputClass} />
            </label>
          </div>
          {editing && (
            <label className="block">
              <span className="text-xs font-semibold mb-1 block text-foreground">Status</span>
              <select value={formData.status} onChange={(e) => set({ status: e.target.value })} className={inputClass}>
                <option value="UPCOMING">Upcoming</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-semibold mb-1 flex items-center gap-1.5 text-foreground">
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
              WhatsApp group link <span className="text-[11px] text-muted-foreground font-normal">(optional)</span>
            </span>
            <input type="url" value={formData.whatsappLink} onChange={(e) => set({ whatsappLink: e.target.value })} className={inputClass} placeholder="https://chat.whatsapp.com/..." />
          </label>
          <div className="flex gap-2.5 pt-3 border-t border-border/60">
            <button type="button" onClick={handleClose} className="ax-ghost-btn flex-1">Cancel</button>
            <button type="submit" disabled={busy} className="ax-primary-btn flex-1 !min-h-11 !text-sm">
              {busy ? (editing ? "Saving…" : "Creating…") : editing ? "Save changes" : "Create event"}
            </button>
          </div>
        </form>
      </div>
    </ModalSurface>
  );
}
