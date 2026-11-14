import {useState} from "react";
import {MessageCircle, ArrowUpRight, X, Sparkles} from "lucide-react";
import ModalSurface from "../ui/ModalSurface";

function normalizeSafeUrl(raw) {
    if (typeof raw !== "string") return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "";
}

function getSeenKey(eventId) {
    return `axiom_whatsapp_popup_seen_${eventId}`;
}

function shouldShowFirstLoginPopup(event) {
    if (typeof window === "undefined") return false;
    const safeUrl = normalizeSafeUrl(event?.whatsappLink);
    if (!safeUrl || !event?.id) return false;
    try {
        if (sessionStorage.getItem("axiom_show_whatsapp_popup") === "true") {
            return true;
        }
        return localStorage.getItem(getSeenKey(event.id)) !== "true";
    } catch {
        return false;
    }
}

export function WhatsAppGroupBanner({whatsappLink, eventName}) {
    const safeUrl = normalizeSafeUrl(whatsappLink);
    if (!safeUrl) return null;

    return (
        <section
            aria-label="Official WhatsApp Community"
            className="axiom-rise rounded-xl border-2 border-[#B9F5D8] bg-[#1D1E18] p-4 text-[#EAFBF5] shadow-sm sm:p-5 dark:border-emerald-400/50 dark:bg-[#171912]"
            style={{"--i": 0}}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#B9F5D8] text-[#141510]">
                        <MessageCircle className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="m-0 text-[11px] font-heading font-bold uppercase tracking-[0.08em] text-[#9FE3C2]">
                            Mandatory Announcements
                        </p>
                        <h2 className="m-0 mt-0.5 font-heading text-base sm:text-lg font-bold text-[#EAFBF5]">
                            Join {eventName ? `${eventName} ` : ""}WhatsApp Group
                        </h2>
                        <p className="m-0 mt-0.5 font-sans text-xs sm:text-sm text-[#BDD9CA]">
                            Get live round check-in alerts, room draws, and motion releases directly on WhatsApp.
                        </p>
                    </div>
                </div>

                <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#B9F5D8] px-5 py-2.5 text-sm font-heading font-bold text-[#141510] shadow-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9F5D8]"
                >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Join Official WhatsApp Group</span>
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
            </div>
        </section>
    );
}

export function WhatsAppFirstLoginModal({event}) {
    const safeUrl = normalizeSafeUrl(event?.whatsappLink);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || !shouldShowFirstLoginPopup(event)) {
        return null;
    }

    const markSeen = () => {
        try {
            if (event?.id) {
                localStorage.setItem(getSeenKey(event.id), "true");
            }
            sessionStorage.removeItem("axiom_show_whatsapp_popup");
        } catch {
            // Ignore storage restrictions
        }
        setDismissed(true);
    };

    return (
        <ModalSurface
            onDismiss={markSeen}
            aria-labelledby="whatsapp-community-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#4A5646] bg-[#1D1E18] p-6 text-[#EAFBF5] shadow-2xl sm:p-7">
                <button
                    type="button"
                    onClick={markSeen}
                    aria-label="Close"
                    className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-[#BDD9CA] transition hover:bg-[#2F322A] hover:text-[#EAFBF5]"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="flex flex-col gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B9F5D8] text-[#141510]">
                        <MessageCircle className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
                    </div>

                    <div>
                        <p className="m-0 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#9FE3C2]">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Official Community</span>
                        </p>
                        <h2
                            id="whatsapp-community-modal-title"
                            className="m-0 mt-1 font-heading text-2xl font-bold text-[#EAFBF5]"
                        >
                            Join {event?.name || "Tournament"} WhatsApp Group
                        </h2>
                        <p className="m-0 mt-2 text-sm leading-relaxed text-[#BDD9CA]">
                            Stay connected with the adjudication core and fellow debaters. All round schedules, check-in calls, room draws, and live updates are posted here first.
                        </p>
                    </div>

                    <div className="mt-1 flex flex-col gap-2.5">
                        <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={markSeen}
                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B9F5D8] px-5 py-3 text-sm font-heading font-bold text-[#141510] shadow-lg transition hover:bg-white"
                        >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            <span>Join WhatsApp Community</span>
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <button
                            type="button"
                            onClick={markSeen}
                            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[#4A5646] px-4 py-2.5 text-xs font-semibold text-[#BDD9CA] transition hover:bg-[#2F322A] hover:text-[#EAFBF5]"
                        >
                            I've already joined · Continue to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </ModalSurface>
    );
}
