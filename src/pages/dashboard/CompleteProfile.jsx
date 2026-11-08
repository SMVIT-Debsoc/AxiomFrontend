import {useEffect, useMemo, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {Check, Loader2} from "lucide-react";
import {useAuth, useUser} from "../../auth/client.jsx";
import {UserApi} from "../../services/api";
import {useToast} from "../../hooks/useToast";
import {UserAvatar} from "../../components/ui/UserAvatar";
import Axiom40Logo from "../../components/brand/Axiom40Logo";
import Sculpture from "../../components/brand/Sculpture";
import LoadingIndicator from "../../components/ui/LoadingIndicator";
import {EVENT_CONFIG as E, COLLEGE_SUGGESTIONS} from "../../config/event";

const inputBase = "box-border h-[52px] w-full rounded-xl border-[1.5px] border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[#B9F5D8] lg:h-[54px] lg:px-4 lg:text-[17px]";

// Keep only the 10 national digits; tolerate pasted "+91 98765 43210" / "098765..." values.
function nationalDigits(value) {
    let d = String(value || "").replace(/\D/g, "");
    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
    if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
    return d.slice(0, 10);
}

function Steps({step}) {
    const items = ["Signed in with Google", "Three details", `Registered for ${E.name}`];
    return (
        <ol aria-label="Registration progress" className="relative m-0 mt-8 flex list-none flex-col gap-3.5 p-0">
            {items.map((label, i) => {
                const state = i < step ? "done" : i === step ? "current" : "todo";
                return (
                    <li key={label} aria-current={state === "current" ? "step" : undefined} className={`flex items-center gap-3.5 text-base ${state === "current" ? "font-bold text-[#EAFBF5]" : "text-[#BDD9CA]"}`}>
                        <span aria-hidden="true" className={`grid h-8 w-8 place-items-center rounded-full text-sm ${state === "done" ? "bg-[#B9F5D8] text-[#141510]" : state === "current" ? "border-2 border-[#EAFBF5]" : "border-2 border-[#6B8F71]"}`}>
                            {state === "done" ? <Check size={16} /> : i + 1}
                        </span>
                        {label}
                    </li>
                );
            })}
        </ol>
    );
}

export default function CompleteProfile() {
    const {user, isLoaded} = useUser();
    const {getToken, signOut} = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(null); // {event, debaterId}
    const [form, setForm] = useState({firstName: "", lastName: "", college: "", usn: "", mobile: "", gender: ""});
    const [editName, setEditName] = useState(false);
    const [touched, setTouched] = useState({college: false, mobile: false, usn: false});

    useEffect(() => {
        if (!isLoaded || !user) return undefined;
        let cancelled = false;
        (async () => {
            let db = null;
            try {
                const token = await getToken();
                db = (await UserApi.getProfile(token)).user;
            } catch (failure) {
                console.error("Error fetching profile:", failure);
            }
            if (cancelled) return;
            setForm({
                firstName: db?.firstName || user.firstName || "",
                lastName: db?.lastName || user.lastName || "",
                college: db?.college || "",
                usn: db?.usn || "",
                mobile: nationalDigits(db?.mobile),
                gender: db?.gender || "",
            });
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [isLoaded, user, getToken]);

    const digits = form.mobile;
    const collegeOk = form.college.trim().length > 1;
    const mobileOk = digits.length === 10;
    const usnOk = form.usn.trim().length >= 4;
    const ready = collegeOk && mobileOk && usnOk;
    const firstName = form.firstName || user?.firstName || "there";
    const fullName = `${form.firstName} ${form.lastName}`.trim() || user?.fullName || user?.email || "Participant";
    const email = user?.primaryEmailAddress?.emailAddress || "";

    const hint = useMemo(() => {
        if (ready) return `You will be enrolled in ${E.name} automatically.`;
        if (!collegeOk) return "Add your college to continue.";
        if (!mobileOk) return "Enter a 10-digit mobile number.";
        return "Add your USN / student ID.";
    }, [ready, collegeOk, mobileOk]);

    const set = (name, value) => { setForm((f) => ({...f, [name]: value})); setError(""); };

    const submit = async (event) => {
        event.preventDefault();
        if (!ready || saving) { setTouched({college: true, mobile: true, usn: true}); return; }
        setSaving(true);
        setError("");
        try {
            const token = await getToken();
            await user.update({firstName: form.firstName, lastName: form.lastName});
            const response = await UserApi.updateProfile({
                firstName: form.firstName,
                lastName: form.lastName,
                college: form.college.trim(),
                usn: form.usn.trim(),
                mobile: `+91${digits}`,
                gender: form.gender,
            }, token);
            const u = response?.user || {};
            setDone({
                event: response?.autoEnrollment || null,
                // Only shown when the API actually returns a human-readable id.
                debaterId: u.debaterId || u.debaterCode || u.displayId || null,
            });
        } catch (failure) {
            console.error("Failed to update profile", failure);
            setError("We couldn't save your details. Please try again.");
            toast.error("Error", "Failed to save changes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (!isLoaded || loading) return <LoadingIndicator fullScreen label="Signing you in" />;
    if (!user) return null;

    const identity = (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <UserAvatar user={user} name={fullName} size="lg" />
            <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-base font-bold text-foreground">{fullName}</p>
                <p className="m-0 truncate text-sm text-muted-foreground">{email}</p>
            </div>
            <button type="button" onClick={() => setEditName((v) => !v)} aria-expanded={editName} className="px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline lg:hidden">Edit</button>
            <button type="button" onClick={() => signOut().catch(() => navigate("/", {replace: true}))} className="hidden px-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline lg:block">Not you?</button>
        </div>
    );

    if (done) {
        const ev = done.event;
        return (
            <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-4 bg-background px-5 py-6 font-sans text-foreground">
                <div className="flex flex-col gap-3.5 rounded-3xl bg-[#1D1E18] p-6 text-[#EAFBF5]">
                    <div aria-hidden="true" className="grid h-[52px] w-[52px] place-items-center rounded-full bg-[#B9F5D8] text-[#141510]"><Check size={28} strokeWidth={3} /></div>
                    <h1 className="font-display text-[56px] font-normal leading-[0.9] text-[#EAFBF5]">You're in, {firstName}.</h1>
                    <p className="m-0 text-base leading-normal text-[#BDD9CA]">
                        {ev ? <>You're registered for {ev.name}. </> : <>Your profile is saved. </>}
                        We've saved {form.college.trim() || "your college"} and your number.
                    </p>
                    {done.debaterId && (
                        <div className="flex items-center justify-between rounded-[14px] bg-[#4A5646] px-4 py-3.5">
                            <div>
                                <p className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-[#BDD9CA]">Your debater ID</p>
                                <p className="m-0 mt-0.5 font-heading text-[26px] font-bold tracking-[0.06em]">{done.debaterId}</p>
                            </div>
                            <p className="m-0 text-right text-[13px] text-[#BDD9CA]">Show this<br />at the desk</p>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2.5 rounded-[20px] border border-border bg-card p-[18px]">
                    <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Up next</p>
                    <p className="m-0 font-heading text-xl font-bold text-foreground">Round 1 check-in opens {E.round1CheckIn}</p>
                    <p className="m-0 text-[15px] leading-normal text-muted-foreground">
                        {ev ? "We'll show a Check in button on your dashboard when it opens. Your room appears once the draw is published." : "Browse events to confirm your enrollment. Your room appears once the draw is published."}
                    </p>
                </div>
                <div className="mt-auto flex flex-col gap-2.5">
                    <Link to="/dashboard" replace className="grid h-14 place-items-center rounded-2xl bg-[#1D1E18] text-[17px] font-bold text-[#EAFBF5] no-underline hover:bg-[#4A5646] dark:bg-[#B9F5D8] dark:text-[#141510]">Go to my dashboard</Link>
                    <Link to={ev ? `/dashboard/events/${encodeURIComponent(ev.id)}` : "/dashboard/events"} replace className="grid h-12 place-items-center rounded-2xl border-[1.5px] border-input text-[15px] font-semibold text-primary no-underline">{ev ? `View ${ev.name}` : "Browse events"}</Link>
                </div>
            </main>
        );
    }

    return (
        <div className="grid min-h-svh bg-background font-sans text-foreground lg:grid-cols-[520px_1fr]">
            <aside className="relative hidden flex-col gap-6 overflow-hidden bg-[#1D1E18] p-10 text-[#EAFBF5] lg:flex">
                <Sculpture figure="vishnu" className="!absolute -bottom-5 -right-[60px] !h-[640px] !w-auto opacity-30 mix-blend-luminosity" />
                <Axiom40Logo variant="nav" className="relative !w-[120px] text-[#EAFBF5]" />
                <Steps step={1} />
                <p className="relative mb-0 mt-auto font-display text-[64px] leading-[0.9]">Clarity<br />under pressure.</p>
            </aside>

            <form onSubmit={submit} noValidate className="flex min-h-svh min-w-0 flex-col lg:min-h-0 lg:items-center lg:justify-center lg:p-10">
                <div className="flex items-center gap-3 px-5 pt-5 lg:hidden">
                    <div aria-hidden="true" className="h-1.5 flex-1 rounded-sm bg-[#1D1E18] dark:bg-[#B9F5D8]" />
                    <div aria-hidden="true" className="h-1.5 flex-1 rounded-sm bg-[#B9F5D8]" />
                    <p className="m-0 whitespace-nowrap text-[13px] font-semibold text-muted-foreground">Last step</p>
                </div>

                <div className="flex w-full max-w-[480px] flex-1 flex-col gap-[18px] p-5 lg:flex-none lg:gap-[22px] lg:p-0">
                    {identity}

                    {editName && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-2"><label htmlFor="cp-first" className="text-[15px] font-semibold">First name</label><input id="cp-first" className={inputBase} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" /></div>
                            <div className="flex flex-col gap-2"><label htmlFor="cp-last" className="text-[15px] font-semibold">Last name</label><input id="cp-last" className={inputBase} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" /></div>
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <h1 className="font-display text-[44px] font-normal leading-[0.95] text-primary lg:text-[64px] lg:leading-[0.92]">Almost in, {firstName}.</h1>
                        <p className="m-0 text-[15px] leading-normal text-muted-foreground lg:mt-2 lg:text-[17px]">Three details so organisers can seat you and reach you on the day.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="cp-college" className="text-[15px] font-semibold">College</label>
                        <input id="cp-college" name="college" className={inputBase} value={form.college} onChange={(e) => set("college", e.target.value)} onBlur={() => setTouched((t) => ({...t, college: true}))} autoComplete="organization" placeholder="Start typing your college" aria-invalid={touched.college && !collegeOk} />
                        {COLLEGE_SUGGESTIONS.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {COLLEGE_SUGGESTIONS.map((c) => (
                                    <button key={c} type="button" onClick={() => set("college", c)} aria-pressed={form.college === c} className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${form.college === c ? "border-[#4A5646] bg-[#4A5646] text-[#EAFBF5]" : "border-input bg-card text-foreground"}`}>{c}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="cp-mobile" className="text-[15px] font-semibold">Mobile number</label>
                        <div className="flex gap-2">
                            <span className="box-border grid h-[52px] place-items-center rounded-xl bg-muted px-3.5 text-base font-semibold text-muted-foreground lg:h-[54px]">+91</span>
                            <input id="cp-mobile" name="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" className={`${inputBase} tracking-wider`} value={form.mobile} onChange={(e) => set("mobile", nationalDigits(e.target.value))} onBlur={() => setTouched((t) => ({...t, mobile: true}))} placeholder="10-digit number" aria-describedby="cp-mobile-hint" aria-invalid={touched.mobile && !mobileOk} />
                        </div>
                        <p id="cp-mobile-hint" className={`m-0 text-[13px] ${touched.mobile && !mobileOk ? "font-medium text-destructive" : "text-muted-foreground"}`}>{touched.mobile && !mobileOk ? "Enter a 10-digit mobile number." : "Only used for event updates on the day."}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="cp-usn" className="text-[15px] font-semibold">USN / student ID</label>
                        <input id="cp-usn" name="usn" className={inputBase} value={form.usn} onChange={(e) => set("usn", e.target.value.toUpperCase())} onBlur={() => setTouched((t) => ({...t, usn: true}))} autoComplete="off" autoCapitalize="characters" placeholder="e.g. 1MV22CS001" aria-describedby="cp-usn-hint" aria-invalid={touched.usn && !usnOk} />
                        <p id="cp-usn-hint" className={`m-0 text-[13px] ${touched.usn && !usnOk ? "font-medium text-destructive" : "text-muted-foreground"}`}>{touched.usn && !usnOk ? "Enter your USN / student ID." : "Used to verify you are a student on the day."}</p>
                    </div>

                    {error && <p role="alert" className="m-0 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">{error}</p>}

                    <div className="hidden flex-col gap-3 lg:flex">
                        <button type="submit" disabled={!ready || saving} className="flex h-[60px] items-center justify-center gap-2 rounded-2xl bg-[#1D1E18] text-lg font-bold text-[#EAFBF5] disabled:cursor-not-allowed disabled:bg-[#AAC9B6] disabled:text-[#44594A] dark:bg-[#B9F5D8] dark:text-[#141510] dark:disabled:bg-muted dark:disabled:text-muted-foreground">{saving && <Loader2 className="animate-spin" size={18} aria-hidden="true" />}Finish registration</button>
                        <p className="m-0 text-center text-sm text-muted-foreground" aria-live="polite">{hint}</p>
                    </div>
                </div>

                {/* Sticky finish bar on phones */}
                <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background px-5 pb-6 pt-4 lg:hidden">
                    <button type="submit" disabled={!ready || saving} className="flex h-[58px] items-center justify-center gap-2 rounded-2xl bg-[#1D1E18] text-lg font-bold text-[#EAFBF5] disabled:cursor-not-allowed disabled:bg-[#AAC9B6] disabled:text-[#44594A] dark:bg-[#B9F5D8] dark:text-[#141510] dark:disabled:bg-muted dark:disabled:text-muted-foreground">{saving && <Loader2 className="animate-spin" size={18} aria-hidden="true" />}Finish registration</button>
                    <p className="m-0 text-center text-[13px] text-muted-foreground" aria-live="polite">{hint}</p>
                    <button type="button" onClick={() => signOut().catch(() => navigate("/", {replace: true}))} className="min-h-10 text-[13px] font-semibold text-primary underline underline-offset-4">Not you? Sign out</button>
                </div>
            </form>
        </div>
    );
}
