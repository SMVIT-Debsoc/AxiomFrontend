import {usePageRequests} from "../../hooks/usePageRequests";
import {lazy, Suspense, useEffect, useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {Database, Search, Users, X} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi, EventApi, WalkInApi} from "../../services/api";
import {useEventSocket, useRoundSocket, SocketEvents, useLiveRefresh} from "../../hooks/useSocket";
import {useSocketRefresh} from "../../hooks/useAdminRealtime";
import {useAdminMutation} from "../../hooks/useAdminMutation";
import LoadError from "../../components/ui/LoadError";
import {useToast} from "../../hooks/useToast";
import {useAdminEvent} from "../../contexts/adminEvent";
import ModalSurface from "../../components/ui/ModalSurface";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import {cn} from "../../lib/utils";
import QrCode from "../../components/ops/QrCode";
import {AreaHeader, AreaTabs} from "../../components/ops/AreaHeader";
import {useAreaTab} from "../../components/ops/useAreaTab";

const AdminParticipants = lazy(() => import("./AdminParticipants"));

const PEOPLE_TABS = [
    {key: "event", label: "This event", icon: Users},
    {key: "registry", label: "All users", icon: Database},
];

const nameOf = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.email || "Unknown";
const initials = (u) => nameOf(u).split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const formatMobile = (m) => {
    const raw = String(m || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    return raw;
};
const ago = (iso) => {
    const t = new Date(iso).getTime();
    if (!t) return "";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    return m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
const incomplete = (u) => !u.college || !u.mobile;

const FILTERS = [["all", "All"], ["incomplete", "Incomplete"], ["absent", "Not checked in"]];

const PEOPLE_FIELDS = ["users", "roster", "rounds"];
const ATTENDANCE_FIELDS = ["attendance"];

/**
 * People: one registry. "This event" = attendance, live registrations, walk-ins
 * and the join QR for the current event; "All users" = every account, enrol
 * into an event, delete.
 */
export default function AdminPeople() {
    const {event, eventId, loading: eventsLoading} = useAdminEvent();
    const [tab, setTab] = useAreaTab(PEOPLE_TABS);
    return (
        <div className="mx-auto max-w-[1180px] font-sans">
            <AreaHeader eyebrow={event?.name || "No event selected"} title="People" />
            <AreaTabs tabs={PEOPLE_TABS} active={tab} onChange={setTab} label="People sections" />
            <div role="tabpanel" aria-labelledby={`area-tab-${tab}`}>
                {tab === "event" ? (
                    <AdminPeoplePage key={eventId} eventId={eventId} eventsLoading={eventsLoading} />
                ) : (
                    <Suspense fallback={<div role="status" aria-label="Loading" className="ax-card h-48 animate-pulse bg-muted/50" />}>
                        <AdminParticipants embedded />
                    </Suspense>
                )}
            </div>
        </div>
    );
}

function AdminPeoplePage({eventId, eventsLoading}) {
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [enrolledIds, setEnrolledIds] = useState(new Set());
    const [round, setRound] = useState(null);
    const [presentIds, setPresentIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [rosterLoading, setRosterLoading] = useState(Boolean(eventId));
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [modal, setModal] = useState(null); // "qr" | "add"
    const [live, setLive] = useState([]);
    const [loadError, setLoadError] = useState(null);
    const refreshPeople = usePageRequests(PEOPLE_FIELDS, async (field, token, options, isCurrent) => {
        try {
            if (!eventId && field !== "users") return;
            const url = {
                users: "/users?limit=500&view=registry",
                roster: `/events/${eventId}/participants`,
                rounds: `/rounds/event/${eventId}?view=summary`,
            }[field];
            const response = await AdminApi.apiRequest(url, "GET", null, token, options);
            if (!isCurrent() || !response.success) return;
            if (field === "users") {
                setUsers(response.users || []);
                setLoadError(null);
            }
            if (field === "roster") setEnrolledIds(new Set((response.participants || []).map((p) => p.id)));
            if (field === "rounds") {
                const list = response.rounds || [];
                setRound(list.find((r) => r.status === "ONGOING")
                    || list.find((r) => r.status !== "COMPLETED") || list.at(-1) || null);
            }
        } catch (failure) {
            if (isCurrent() && field === "users") {
                if (!options.skipCache) toast.error("Error", failure?.message || "Failed to load people");
                setLoadError(failure?.message || "Failed to load people");
            }
            console.error("Failed to load people", failure);
        } finally {
            if (isCurrent() && field === "users") setLoading(false);
            if (isCurrent() && field === "roster") setRosterLoading(false);
        }
    });

    useEffect(() => { setPresentIds(new Set()); }, [round?.id]);
    const refreshAttendance = usePageRequests(ATTENDANCE_FIELDS, async (_field, token, options, isCurrent) => {
        if (!round?.id) return;
        const response = await AdminApi.apiRequest(`/check-in/round/${round.id}?view=attendance`, "GET", null, token, options);
        if (isCurrent() && response.success) {
            setPresentIds(new Set((response.checkIns || []).filter((ci) => ci.status === "PRESENT").map((ci) => ci.userId)));
        }
    }, undefined, round?.id);

    useEventSocket(eventId, {
        onEventEnrollment: (data) => {
            setLive((prev) => [{key: `${Date.now()}`, name: data?.userName || data?.name || "New debater", college: data?.college || "", at: new Date().toISOString()}, ...prev].slice(0, 6));
            refreshPeople("users", "roster");
        },
        onCheckInCount: (data) => {
            if (data.roundId === round?.id) refreshAttendance("attendance");
        },
        onRoundCreated: () => refreshPeople("rounds"),
        onRoundStatusChange: () => refreshPeople("rounds"),
        onRoundUpdated: () => refreshPeople("rounds"),
        onRoundDeleted: () => refreshPeople("rounds"),
    });

    useRoundSocket(round?.id, {
        onCheckInUpdate: (data) => {
            const uid = data?.userId || data?.user?.id;
            if (!uid || !data?.status) {
                refreshAttendance("attendance");
                return;
            }
            setPresentIds((prev) => {
                const next = new Set(prev);
                if (data.status === "PRESENT") next.add(uid);
                else next.delete(uid);
                return next;
            });
        },
    });
    useLiveRefresh(() => {
        refreshPeople(...PEOPLE_FIELDS);
        refreshAttendance("attendance");
    }, {eventId, roundId: round?.id, jitterMs: 3000, invalidateCache: false});
    // Debounced: a burst of profile edits collapses into one registry read. usePageRequests
    // keeps one request per section in flight, so responses cannot land out of order.
    useSocketRefresh([SocketEvents.USER_UPDATED, SocketEvents.USER_DELETED], () => refreshPeople("users", "roster"));

    // Event participants plus anyone whose profile is still incomplete
    const rows = useMemo(() => users.filter((u) => enrolledIds.has(u.id) || incomplete(u)).map((u) => ({
        ...u,
        enrolled: enrolledIds.has(u.id),
        status: presentIds.has(u.id) ? "in" : incomplete(u) ? "inc" : "reg",
    })), [users, enrolledIds, presentIds]);

    const q = search.trim().toLowerCase();
    const shown = rows.filter((u) => {
        if (filter === "incomplete" && !incomplete(u)) return false;
        if (filter === "absent" && (presentIds.has(u.id) || !u.enrolled)) return false;
        return !q || `${nameOf(u)} ${u.email || ""} ${u.mobile || ""} ${u.college || ""} ${u.usn || ""} ${u.gender || ""}`.toLowerCase().includes(q);
    });

    const lastHour = users.filter((u) => enrolledIds.has(u.id) && u.createdAt && Date.now() - new Date(u.createdAt).getTime() < 3600000).length;
    const recent = users.filter((u) => enrolledIds.has(u.id) && u.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    const stats = [
        ["Registered", rosterLoading ? "…" : enrolledIds.size],
        ["Joined last hour", rosterLoading ? "…" : `+${lastHour}`],
        ["Profile incomplete", users.filter(incomplete).length],
        [`Checked in${round ? ` · R${round.roundNumber}` : ""}`, round ? presentIds.size : "—"],
    ];
    const statusChip = {in: ["Checked in", "ax-chip--ok"], reg: ["Registered", "ax-chip--idle"], inc: ["Needs details", "ax-chip--warn"]};

    if (eventsLoading || loading) return <div className="grid min-h-[50vh] place-items-center"><LoadingIndicator label="Loading people" /></div>;
    if (loadError && users.length === 0) {
        return <LoadError className="mt-6" message="Could not load people." detail={loadError} onRetry={() => refreshPeople(...PEOPLE_FIELDS)} />;
    }

    return (
        <div>
            <div className="mb-3 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setModal("qr")} className="ax-ghost-btn flex-1 sm:flex-none">Show join QR</button>
                <button type="button" onClick={() => setModal("add")} disabled={!eventId || rosterLoading} className="ax-primary-btn flex-1 !min-h-11 !text-sm sm:flex-none">+ Add walk-in</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {stats.map(([label, value]) => (
                    <div key={label} className="ax-card p-3.5 md:p-4"><p className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p><p className="m-0 mt-1 font-display text-4xl leading-none text-primary">{value}</p></div>
                ))}
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
                <section aria-labelledby="ppl-list" className="ax-card order-2 p-4 md:p-5 lg:order-1">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h2 id="ppl-list" className="mr-auto font-heading text-xl font-bold">All debaters</h2>
                        <label className="relative block w-full sm:w-64">
                            <span className="sr-only">Search debaters</span>
                            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, college, ID" className="h-11 w-full rounded-xl border-[1.5px] border-input bg-card pl-9 pr-9 text-[15px]" />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    aria-label="Clear search"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            )}
                        </label>
                        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
                            {FILTERS.map(([key, label]) => (
                                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn("min-h-11 rounded-full border px-3.5 text-xs sm:text-sm font-semibold", filter === key ? "border-[#1D1E18] bg-[#1D1E18] text-[#EAFBF5] dark:border-[#B9F5D8] dark:bg-[#B9F5D8] dark:text-[#141510]" : "border-input bg-card")}>{label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Phone: cards */}
                    <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
                        {shown.slice(0, 200).map((u) => (
                            <li key={u.id} className="flex items-start gap-3 rounded-2xl border border-border p-3">
                                <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#4A5646] font-heading font-bold text-[#EAFBF5]">{initials(u)}</div>
                                <div className="min-w-0 flex-1">
                                    <p className="m-0 truncate font-bold">{nameOf(u)}</p>
                                    <p className="m-0 truncate text-[13px] text-muted-foreground">{u.college || "No college"}{u.usn ? ` · ${u.usn}` : ""}{u.gender ? ` · ${u.gender}` : ""}</p>
                                    <p className="m-0 mt-0.5 truncate text-[13px] text-foreground tabular-nums">
                                        {formatMobile(u.mobile) ? <a className="font-semibold underline-offset-2 hover:underline" href={`tel:${u.mobile}`}>{formatMobile(u.mobile)}</a> : "No phone"}
                                        {u.email ? ` · ${u.email}` : ""}
                                    </p>
                                </div>
                                <span className={cn("ax-chip shrink-0", statusChip[u.status][1])}>{statusChip[u.status][0]}</span>
                            </li>
                        ))}
                    </ul>
                    {/* Desktop: table */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-[15px]">
                            <thead><tr className="text-xs uppercase tracking-[0.06em] text-muted-foreground"><th scope="col" className="py-2 pr-3">Debater</th><th scope="col" className="py-2 pr-3">College</th><th scope="col" className="py-2 pr-3">Mobile</th><th scope="col" className="py-2 pr-3">USN / Gender</th><th scope="col" className="py-2">Status</th></tr></thead>
                            <tbody>{shown.slice(0, 300).map((u) => (
                                <tr key={u.id}>
                                    <td className="py-2.5 pr-3"><span className="font-semibold">{nameOf(u)}</span><br /><span className="text-[13px] text-muted-foreground">{u.email}</span></td>
                                    <td className="py-2.5 pr-3">{u.college || "—"}</td>
                                    <td className="py-2.5 pr-3 tabular-nums whitespace-nowrap">{formatMobile(u.mobile) ? <a className="font-medium text-foreground hover:text-primary hover:underline" href={`tel:${u.mobile}`}>{formatMobile(u.mobile)}</a> : "—"}</td>
                                    <td className="py-2.5 pr-3"><span className="font-mono text-xs">{u.usn || "—"}</span>{u.gender ? <span className="ml-1.5 text-xs text-muted-foreground">({u.gender})</span> : null}</td>
                                    <td className="py-2.5"><span className={cn("ax-chip", statusChip[u.status][1])}>{statusChip[u.status][0]}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {shown.length === 0 && <p className="m-0 py-6 text-center text-muted-foreground">{rows.length === 0 ? "Nobody has registered yet." : "No one matches this filter."}</p>}
                    <p className="m-0 mt-3 text-sm text-muted-foreground">Need to remove someone or enrol into a different event? <Link className="font-semibold text-primary underline underline-offset-2" to="/admin/people?tab=registry">All users</Link>.</p>
                </section>

                <aside aria-labelledby="feed" className="ax-card order-1 p-4 lg:order-2">
                    <div className="mb-2 flex items-center justify-between"><h2 id="feed" className="font-heading text-lg font-bold">Live registrations</h2><span className="ax-chip ax-chip--ok">Live</span></div>
                    <ul className="m-0 flex list-none flex-col p-0">
                        {live.map((f) => (
                            <li key={f.key} className="flex items-center justify-between gap-2 border-t border-border py-2.5 first:border-t-0"><div className="min-w-0"><p className="m-0 truncate font-semibold">{f.name}</p><p className="m-0 truncate text-[13px] text-muted-foreground">{f.college}</p></div><span className="text-[13px] font-semibold text-primary">now</span></li>
                        ))}
                        {recent.map((u) => (
                            <li key={u.id} className="flex items-center justify-between gap-2 border-t border-border py-2.5 first:border-t-0"><div className="min-w-0"><p className="m-0 truncate font-semibold">{nameOf(u)}</p><p className="m-0 truncate text-[13px] text-muted-foreground">{u.college}</p></div><span className="text-[13px] text-muted-foreground">{ago(u.createdAt)}</span></li>
                        ))}
                    </ul>
                    {live.length + recent.length === 0 && <p className="m-0 py-3 text-sm text-muted-foreground">No registrations yet.</p>}
                    <p className="m-0 mt-2 text-[13px] leading-snug text-muted-foreground">New sign-ups are auto-enrolled and show here the moment they finish.</p>
                </aside>
            </div>

            {modal === "qr" && <QrModal onClose={() => setModal(null)} />}
            {modal === "add" && <AddWalkInModal users={users} enrolledIds={enrolledIds} eventId={eventId} onClose={() => setModal(null)} onDone={() => { setModal(null); refreshPeople("users", "roster"); }} />}
        </div>
    );
}

function Sheet({title, onClose, children}) {
    return (
        <ModalSurface onDismiss={onClose} aria-label={title} className="flex items-end justify-center md:items-center">
            <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 text-foreground shadow-2xl md:rounded-3xl">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-xl font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full"><X size={20} aria-hidden="true" /></button></div>
                {children}
            </div>
        </ModalSurface>
    );
}

function QrModal({onClose}) {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
    };
    return (
        <Sheet title="Join link" onClose={onClose}>
            <p className="m-0 text-muted-foreground">Debaters scan this, sign in with Google and add three details. They're enrolled automatically.</p>
            <div className="my-4 flex flex-col items-center gap-2">
                <QrCode value={url} size={240} label="Scan to join" />
                <p className="m-0 max-w-xs text-center text-sm text-muted-foreground">Scan with your phone's camera app — not inside Instagram or WhatsApp.</p>
            </div>
            <p className="mb-4 mt-0 break-all rounded-2xl bg-muted p-3 text-center font-heading text-lg font-bold text-primary">{url}</p>
            <button type="button" onClick={copy} className="ax-primary-btn w-full">{copied ? "Copied" : "Copy link"}</button>
        </Sheet>
    );
}

function AddWalkInModal({users, enrolledIds, eventId, onClose, onDone}) {
    const {getToken} = useAuth();
    const {run, isBusy} = useAdminMutation();
    const [q, setQ] = useState("");
    const [tab, setTab] = useState("search"); // "search" | "walkin"
    const candidates = users.filter((u) => !enrolledIds.has(u.id)).filter((u) => !q.trim() || `${nameOf(u)} ${u.email || ""} ${u.mobile || ""} ${u.usn || ""} ${u.college || ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
    const enroll = (u) => run("enroll", async () => {
        const token = await getToken();
        return EventApi.enrollUserManual(eventId, u.id, token);
    }, {success: `${nameOf(u)} is enrolled`, onSuccess: () => onDone(), onConflict: () => onDone()});
    return (
        <Sheet title="Add walk-in" onClose={onClose}>
            <div role="group" aria-label="Walk-in method" className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-muted p-1">
                {[["search", "Signed-up people"], ["walkin", "New walk-in (no phone)"]].map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={cn("min-h-11 rounded-xl px-3 text-sm font-semibold", tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{label}</button>
                ))}
            </div>
            {tab === "search" && (<>
            <p className="m-0 mb-3 text-sm text-muted-foreground">Walk-ins sign in with Google on their own phone first. Find them here and enrol them.</p>
            <label className="block"><span className="sr-only">Search signed-up people</span><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or college" className="mb-3 h-12 w-full rounded-xl border-[1.5px] border-input bg-card px-3 text-base" /></label>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {candidates.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                        <div className="min-w-0 flex-1"><p className="m-0 truncate font-semibold">{nameOf(u)}</p><p className="m-0 truncate text-[13px] text-muted-foreground">{u.email}</p></div>
                        <button type="button" disabled={isBusy("enroll")} onClick={() => enroll(u)} className="ax-ghost-btn !min-h-11">{isBusy("enroll") ? "…" : "Enrol"}</button>
                    </li>
                ))}
            </ul>
            {candidates.length === 0 && <p className="m-0 py-4 text-center text-muted-foreground">No signed-up people left to enrol.</p>}
            </>)}
            {tab === "walkin" && <WalkInForm eventId={eventId} onDone={onDone} />}
        </Sheet>
    );
}

const WALKIN_MOBILE_RE = /^[6-9]\d{9}$/;
const walkInInput = "h-12 w-full rounded-xl border-[1.5px] border-input bg-card px-3 text-base text-foreground";

function WalkInForm({eventId, onDone}) {
    const {getToken} = useAuth();
    const toast = useToast();
    const [form, setForm] = useState({firstName: "", lastName: "", college: "", usn: "", mobile: "", email: ""});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const set = (name, value) => { setForm((f) => ({...f, [name]: value})); setError(""); };

    const submit = async (event) => {
        event.preventDefault();
        if (saving) return;
        const digits = form.mobile.replace(/\D/g, "").slice(-10);
        const problem = !form.firstName.trim() ? "Enter a first name."
            : !form.lastName.trim() ? "Enter a last name."
            : form.college.trim().length < 2 ? "Enter the college."
            : !WALKIN_MOBILE_RE.test(digits) ? "Enter a 10-digit mobile number starting with 6-9."
            : form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "Enter a valid email, or leave it blank."
            : "";
        if (problem) { setError(problem); return; }
        setSaving(true);
        setError("");
        try {
            const token = await getToken();
            await WalkInApi.createWalkIn({
                eventId,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                college: form.college.trim(),
                usn: form.usn.trim().toUpperCase(),
                mobile: `+91${digits}`,
                email: form.email.trim(),
            }, token);
            toast.success(`${form.firstName.trim()} ${form.lastName.trim()} added as a walk-in`);
            onDone();
        } catch (failure) {
            setError(failure?.message || "Could not add the walk-in. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <p className="m-0 text-sm text-muted-foreground">For someone without a phone or Google account. Name, college and mobile are required.</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">First name<input className={walkInInput} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="off" /></label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">Last name<input className={walkInInput} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="off" /></label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">College<input className={walkInInput} value={form.college} onChange={(e) => set("college", e.target.value)} autoComplete="off" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">Mobile number<span className="flex items-center gap-2"><span className="grid h-12 place-items-center rounded-xl bg-muted px-3 text-base font-semibold text-muted-foreground">+91</span><input type="tel" inputMode="numeric" className={`${walkInInput} tracking-wider`} value={form.mobile} onChange={(e) => set("mobile", e.target.value)} autoComplete="off" /></span></label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">USN <span className="font-normal text-muted-foreground">(optional)</span><input className={`${walkInInput} uppercase`} value={form.usn} onChange={(e) => set("usn", e.target.value)} autoComplete="off" autoCapitalize="characters" /></label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Email <span className="font-normal text-muted-foreground">(optional)</span><input type="email" inputMode="email" className={walkInInput} value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" /></label>
            {error && <p role="alert" className="m-0 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">{error}</p>}
            <button type="submit" disabled={saving} className="ax-primary-btn w-full !min-h-12">{saving ? "Adding…" : "Add walk-in and enrol"}</button>
        </form>
    );
}
