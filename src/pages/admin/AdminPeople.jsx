import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link} from "react-router-dom";
import {Search, X} from "lucide-react";
import {useAuth} from "../../auth/client.jsx";
import {AdminApi, EventApi, UserApi} from "../../services/api";
import {useEventSocket} from "../../hooks/useSocket";
import {useToast} from "../../hooks/useToast";
import {useAdminEvent} from "../../contexts/adminEvent";
import ModalSurface from "../../components/ui/ModalSurface";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import {cn} from "../../lib/utils";

const nameOf = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.email || "Unknown";
const initials = (u) => nameOf(u).split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const maskMobile = (m) => {
    const d = String(m || "").replace(/\D/g, "").slice(-10);
    return d.length === 10 ? `${d.slice(0, 2)}••• ••${d.slice(-3)}` : "";
};
const ago = (iso) => {
    const t = new Date(iso).getTime();
    if (!t) return "";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    return m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
};
const incomplete = (u) => !u.college || !u.mobile;

const FILTERS = [["all", "All"], ["incomplete", "Incomplete"], ["absent", "Not checked in"]];

export default function AdminPeople() {
    const {getToken} = useAuth();
    const toast = useToast();
    const {event, eventId, loading: eventsLoading} = useAdminEvent();
    const [users, setUsers] = useState([]);
    const [enrolledIds, setEnrolledIds] = useState(new Set());
    const [round, setRound] = useState(null);
    const [presentIds, setPresentIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [modal, setModal] = useState(null); // "qr" | "add"
    const [live, setLive] = useState([]);
    const getTokenRef = useRef(getToken);
    useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

    const load = useCallback(async () => {
        try {
            const token = await getTokenRef.current();
            const [usersRes, partsRes, roundsRes] = await Promise.all([
                UserApi.list(token, 500),
                eventId ? EventApi.getParticipants(eventId, token) : Promise.resolve(null),
                eventId ? AdminApi.apiRequest(`/rounds/event/${eventId}`, "GET", null, token) : Promise.resolve(null),
            ]);
            setUsers(usersRes.success ? usersRes.users || [] : []);
            setEnrolledIds(new Set(partsRes?.success ? (partsRes.participants || []).map((p) => p.id) : []));
            const list = (roundsRes?.success ? roundsRes.rounds || [] : []).slice().sort((a, b) => a.roundNumber - b.roundNumber);
            const cur = list.find((r) => String(r.status).toUpperCase() === "ONGOING") || list.find((r) => String(r.status).toUpperCase() !== "COMPLETED") || list[list.length - 1];
            if (cur) {
                const detail = await AdminApi.apiRequest(`/rounds/${cur.id}`, "GET", null, token);
                setRound(cur);
                setPresentIds(new Set(detail.success ? (detail.round.checkIns || []).filter((c) => c.status === "PRESENT").map((c) => c.userId) : []));
            } else { setRound(null); setPresentIds(new Set()); }
        } catch (failure) {
            console.error("Failed to load people", failure);
            toast.error("Error", "Failed to load people");
        } finally { setLoading(false); }
    }, [eventId, toast]);

    useEffect(() => { setLoading(true); load(); }, [load]);

    // Live registrations: new enrolments arrive over the event socket.
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    useEventSocket(eventId, {
        onEventEnrollment: (data) => {
            setLive((prev) => [{key: `${Date.now()}`, name: data?.userName || data?.name || "New debater", college: data?.college || "", at: new Date().toISOString()}, ...prev].slice(0, 6));
            clearTimeout(timer.current);
            timer.current = setTimeout(load, 400);
        },
        onCheckInCount: () => { clearTimeout(timer.current); timer.current = setTimeout(load, 600); },
    });

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
        return !q || `${nameOf(u)} ${u.email || ""} ${u.college || ""} ${u.usn || ""}`.toLowerCase().includes(q);
    });

    const lastHour = users.filter((u) => enrolledIds.has(u.id) && u.createdAt && Date.now() - new Date(u.createdAt).getTime() < 3600000).length;
    const recent = users.filter((u) => enrolledIds.has(u.id) && u.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    const stats = [
        ["Registered", enrolledIds.size],
        ["Joined last hour", `+${lastHour}`],
        ["Profile incomplete", users.filter(incomplete).length],
        [`Checked in${round ? ` · R${round.roundNumber}` : ""}`, round ? presentIds.size : "—"],
    ];
    const statusChip = {in: ["Checked in", "ax-chip--ok"], reg: ["Registered", "ax-chip--idle"], inc: ["Needs details", "ax-chip--warn"]};

    if (eventsLoading || loading) return <div className="grid min-h-[50vh] place-items-center"><LoadingIndicator label="Loading people" /></div>;

    return (
        <div className="mx-auto max-w-[1180px] font-sans">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{event?.name || "No event selected"}</p>
                    <h1 className="font-display text-[44px] font-normal leading-[0.95] text-primary md:text-[56px]">People</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setModal("qr")} className="ax-ghost-btn">Show join QR</button>
                    <button type="button" onClick={() => setModal("add")} disabled={!eventId} className="ax-primary-btn !min-h-11 !text-sm">+ Add walk-in</button>
                </div>
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
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, college, ID" className="h-11 w-full rounded-xl border-[1.5px] border-input bg-card pl-9 pr-3 text-[15px]" />
                        </label>
                        <div role="group" aria-label="Filter" className="flex gap-1.5">
                            {FILTERS.map(([key, label]) => (
                                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn("min-h-10 rounded-full border px-3.5 text-sm font-semibold", filter === key ? "border-[#243D38] bg-[#243D38] text-[#EEF8E4] dark:border-[#C5EDAC] dark:bg-[#C5EDAC] dark:text-[#172923]" : "border-input bg-card")}>{label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Phone: cards */}
                    <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
                        {shown.slice(0, 200).map((u) => (
                            <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                                <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#47695F] font-heading font-bold text-[#EEF8E4]">{initials(u)}</div>
                                <div className="min-w-0 flex-1"><p className="m-0 truncate font-bold">{nameOf(u)}</p><p className="m-0 truncate text-[13px] text-muted-foreground">{u.college || "No college"}{u.usn ? ` · ${u.usn}` : ""}</p></div>
                                <span className={cn("ax-chip", statusChip[u.status][1])}>{statusChip[u.status][0]}</span>
                            </li>
                        ))}
                    </ul>
                    {/* Desktop: table */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-[15px]">
                            <thead><tr className="text-xs uppercase tracking-[0.06em] text-muted-foreground"><th scope="col" className="py-2 pr-3">Debater</th><th scope="col" className="py-2 pr-3">College</th><th scope="col" className="py-2 pr-3">Mobile</th><th scope="col" className="py-2 pr-3">USN</th><th scope="col" className="py-2">Status</th></tr></thead>
                            <tbody>{shown.slice(0, 300).map((u) => (
                                <tr key={u.id}>
                                    <td className="py-2.5 pr-3"><span className="font-semibold">{nameOf(u)}</span><br /><span className="text-[13px] text-muted-foreground">{u.email}</span></td>
                                    <td className="py-2.5 pr-3">{u.college || "—"}</td>
                                    <td className="py-2.5 pr-3 tabular-nums">{maskMobile(u.mobile) || "—"}</td>
                                    <td className="py-2.5 pr-3">{u.usn || "—"}</td>
                                    <td className="py-2.5"><span className={cn("ax-chip", statusChip[u.status][1])}>{statusChip[u.status][0]}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                    {shown.length === 0 && <p className="m-0 py-6 text-center text-muted-foreground">{rows.length === 0 ? "Nobody has registered yet." : "No one matches this filter."}</p>}
                    <p className="m-0 mt-3 text-sm text-muted-foreground">Need to remove someone or enrol into a different event? <Link className="font-semibold text-primary underline underline-offset-2" to="/admin/participants">Advanced participant tools</Link>.</p>
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
            {modal === "add" && <AddWalkInModal users={users} enrolledIds={enrolledIds} eventId={eventId} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
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
            <p className="m-0 text-muted-foreground">Debaters open this address, sign in with Google and add three details. Print it as a QR at the desk using any QR generator.</p>
            <p className="my-4 break-all rounded-2xl bg-muted p-4 text-center font-heading text-2xl font-bold text-primary">{url}</p>
            <button type="button" onClick={copy} className="ax-primary-btn w-full">{copied ? "Copied" : "Copy link"}</button>
        </Sheet>
    );
}

function AddWalkInModal({users, enrolledIds, eventId, onClose, onDone}) {
    const {getToken} = useAuth();
    const toast = useToast();
    const [q, setQ] = useState("");
    const [busyId, setBusyId] = useState(null);
    const candidates = users.filter((u) => !enrolledIds.has(u.id)).filter((u) => !q.trim() || `${nameOf(u)} ${u.email || ""} ${u.college || ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
    const enroll = async (u) => {
        setBusyId(u.id);
        try {
            const token = await getToken();
            const res = await EventApi.enrollUserManual(eventId, u.id, token);
            if (res.success) { toast.success("Added", `${nameOf(u)} is enrolled.`); onDone(); }
            else toast.error("Could not add", res.error || "Enrolment failed");
        } catch { toast.error("Error", "Enrolment failed"); } finally { setBusyId(null); }
    };
    return (
        <Sheet title="Add walk-in" onClose={onClose}>
            <p className="m-0 mb-3 text-sm text-muted-foreground">Walk-ins sign in with Google on their own phone first. Find them here and enrol them.</p>
            <label className="block"><span className="sr-only">Search signed-up people</span><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or college" className="mb-3 h-12 w-full rounded-xl border-[1.5px] border-input bg-card px-3 text-base" /></label>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {candidates.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                        <div className="min-w-0 flex-1"><p className="m-0 truncate font-semibold">{nameOf(u)}</p><p className="m-0 truncate text-[13px] text-muted-foreground">{u.email}</p></div>
                        <button type="button" disabled={busyId === u.id} onClick={() => enroll(u)} className="ax-ghost-btn !min-h-11">{busyId === u.id ? "…" : "Enrol"}</button>
                    </li>
                ))}
            </ul>
            {candidates.length === 0 && <p className="m-0 py-4 text-center text-muted-foreground">No signed-up people left to enrol.</p>}
        </Sheet>
    );
}
