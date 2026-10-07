import {useState, useEffect} from "react";
import {useUser, useAuth} from "@clerk/clerk-react";
import {useNavigate} from "react-router-dom";
import {
  User,
  Mail,
  School,
  Hash,
  Save,
  Loader2,
  Phone,
  CheckCircle,
  AlertTriangle,
  UserCircle,
} from "lucide-react";
import {UserApi, EventApi, CheckInApi} from "../../services/api";
import {useToast} from "../../hooks/useToast"
import {
  ProfileHeaderSkeleton,
  CardSkeleton,
} from "../../components/ui/Skeleton";
import {UserAvatar} from "../../components/ui/UserAvatar";
import NeoCard from "../../components/neo/NeoCard";
import NeoProgressBar from "../../components/neo/NeoProgressBar";

export default function Profile({isOnboarding = false}) {
  const {user, isLoaded} = useUser();
  const {getToken} = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    college: "",
    usn: "",
    mobile: "",
    gender: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (isLoaded && user) {
        try {
          setLoading(true);
          const token = await getToken();

          // Fetch profile from backend database (this also syncs/creates user if needed)
          const response = await UserApi.getProfile(token);
          const dbUser = response.user;

          // Populate form with backend data, falling back to Clerk data
          setFormData({
            firstName: dbUser?.firstName || user.firstName || "",
            lastName: dbUser?.lastName || user.lastName || "",
            college: dbUser?.college || "",
            usn: dbUser?.usn || "",
            mobile:
              dbUser?.mobile || user.primaryPhoneNumber?.phoneNumber || "",
            gender: dbUser?.gender || "",
          });
        } catch (err) {
          console.error("Error fetching profile:", err);
          // Fallback to Clerk data if backend fetch fails
          setFormData({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            college: "",
            usn: "",
            mobile: user.primaryPhoneNumber?.phoneNumber || "",
            gender: "",
          });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [isLoaded, user, getToken]);

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate mandatory fields for onboarding
    if (isOnboarding && (!formData.college || !formData.mobile)) {
      setError("College and Mobile Number are required to continue.");
      toast.error(
        "Required Fields",
        "Please fill in your college and mobile number."
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();

      // Sync with Backend (this will upsert the user)
      await UserApi.updateProfile(
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          college: formData.college,
          usn: formData.usn,
          mobile: formData.mobile,
          gender: formData.gender,
        },
        token
      );

      // Also update Clerk user data for consistency
      await user.update({
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      if (isOnboarding) {
        // If onboarding, register for current event and redirect to dashboard
        try {
          // Fetch current/ongoing events
          const eventsResponse = await EventApi.list(token, "ONGOING");
          const ongoingEvents = eventsResponse.events || [];

          if (ongoingEvents.length > 0) {
            const currentEvent = ongoingEvents[0];

            // Check if there's an ongoing round to check into
            const ongoingRound = currentEvent.rounds?.find(
              (r) => r.status === "ONGOING"
            );

            if (ongoingRound) {
              try {
                // Auto check-in if check-in is open
                await CheckInApi.checkIn(ongoingRound.id, token);
                toast.success(
                  "Registered Successfully! 🎉",
                  `You have been registered for ${currentEvent.name} and checked in!`
                );
              } catch {
                // Check-in might not be open yet, that's okay
                toast.success(
                  "Registered Successfully! 🎉",
                  `You have been registered for ${currentEvent.name}!`
                );
              }
            } else {
              toast.success(
                "Registered Successfully! 🎉",
                `You have been registered for ${currentEvent.name}!`
              );
            }
          } else {
            toast.success(
              "Profile Complete! 🎉",
              "Your profile has been saved. Check events to register!"
            );
          }
        } catch (eventError) {
          console.error("Event registration error:", eventError);
          toast.success(
            "Profile Complete! 🎉",
            "Your profile has been saved successfully!"
          );
        }

        // Redirect to dashboard
        navigate("/dashboard", {replace: true});
      } else {
        setSuccess(true);
        toast.success(
          "Profile Updated",
          "Your profile has been saved successfully!"
        );
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Failed to update profile", error);
      setError("Failed to save changes. Please try again later.");
      toast.error("Error", "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || loading)
    return (
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {!isOnboarding && (
          <div className="mb-8">
            <div className="h-8 w-32 bg-muted rounded mb-2 animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
        )}
        <ProfileHeaderSkeleton />
        <CardSkeleton />
      </div>
    );

  const isProfileComplete = formData.college && formData.mobile;
  const completeness = (() => {
    const items = [
      {label: "First and last name", ok: Boolean(formData.firstName && formData.lastName)},
      {label: "College or institution", ok: Boolean(formData.college)},
      {label: "Mobile number", ok: Boolean(formData.mobile)},
      {label: "Student ID", ok: Boolean(formData.usn)},
    ];
    return {items, done: items.filter((item) => item.ok).length, total: items.length};
  })();

  return (
    <div className={isOnboarding ? "max-w-2xl mx-auto space-y-6" : "space-y-4"}>
      {/* Onboarding Header */}
      {isOnboarding && (
        <div className="axiom-page-header mb-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <UserCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <span className="axiom-eyebrow text-xs tracking-wider uppercase text-primary font-heading font-semibold">
            Registration
          </span>
          <h1 className="text-2xl font-heading font-bold text-foreground mt-1">Complete Your Profile</h1>
          <p className="text-xs text-muted-foreground font-sans mt-0.5">
            Fill in your institutional identity to participate in tournament debates.
          </p>
        </div>
      )}

      {/* Regular Header */}
      {!isOnboarding && (
        <div className="axiom-page-header">
          <span className="axiom-eyebrow text-xs tracking-wider uppercase text-primary font-heading font-semibold">
            Identity
          </span>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mt-1">My Profile</h1>
          <p className="text-sm text-muted-foreground font-sans mt-0.5">
            Manage your personal credentials and tournament identity.
          </p>
        </div>
      )}

      {success && !isOnboarding && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-2 text-xs font-sans">
          <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span><strong className="font-semibold">Saved:</strong> Profile details successfully synchronized.</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2 text-xs font-sans">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span><strong className="font-semibold">Error:</strong> {error}</span>
        </div>
      )}

      {!isOnboarding && !isProfileComplete && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-3.5 rounded-lg flex items-center gap-3 text-xs font-sans">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold">Action Required</span>
            <p className="opacity-90 mt-0.5">
              Please enter your College and Mobile Number to unlock all tournament features.
            </p>
          </div>
        </div>
      )}

      <div className={isOnboarding ? "" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] items-start"}>
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Profile Card Header */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-center gap-3.5">
          <UserAvatar user={user} name={`${formData.firstName} ${formData.lastName}`.trim()} size="xl" className="axiom-avatar-pop" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-heading font-bold text-foreground truncate">
              {formData.firstName} {formData.lastName}
            </h2>
            <p className="text-xs text-muted-foreground font-sans truncate">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4 font-sans text-xs">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-first-name" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> First Name
              </label>
              <input
                id="profile-first-name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="First Name"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-last-name" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> Last Name
              </label>
              <input
                id="profile-last-name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Last Name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-college" className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> College /
              Institution
              {isOnboarding && <span className="text-destructive">*</span>}
            </label>
            <input
              id="profile-college"
              name="college"
              value={formData.college}
              onChange={handleChange}
              required={isOnboarding}
              className={`w-full bg-background border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                isOnboarding && !formData.college
                  ? "border-amber-500/50"
                  : "border-border"
              }`}
              placeholder="e.g. National Law School of India University"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-mobile" className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> Mobile Number
              {isOnboarding && <span className="text-destructive">*</span>}
            </label>
            <input
              id="profile-mobile"
              type="tel"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              required={isOnboarding}
              className={`w-full bg-background border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                isOnboarding && !formData.mobile
                  ? "border-amber-500/50"
                  : "border-border"
              }`}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-usn" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> USN / Student
                ID
                <span className="text-[10px] text-muted-foreground">
                  (Optional)
                </span>
              </label>
              <input
                id="profile-usn"
                name="usn"
                value={formData.usn}
                onChange={handleChange}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Student Registration ID"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="profile-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> Email (Read
                Only)
              </label>
              <input
                id="profile-email"
                disabled
                value={user.primaryEmailAddress?.emailAddress || ""}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          {/* Gender Field - Optional */}
          {!isOnboarding && (
            <div className="space-y-1.5">
              <label htmlFor="profile-gender" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" /> Gender
                <span className="text-[10px] text-muted-foreground">
                  (Optional)
                </span>
              </label>
              <select
                id="profile-gender"
                name="gender"
                value={formData.gender || ""}
                onChange={handleChange}
                className="w-full max-w-xs bg-background border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                }}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <div className="pt-3">
            <button
              type="submit"
              disabled={
                saving ||
                (isOnboarding && (!formData.college || !formData.mobile))
              }
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {isOnboarding ? "Complete Profile & Register" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {!isOnboarding && (
        <div className="hidden lg:grid gap-5 min-w-0">
        <NeoCard
          role="complementary"
          aria-label="Your portrait"
          className="overflow-hidden text-center axiom-rise"
          style={{"--i": 2}}
        >
          <div className="bg-primary px-6 pt-8 pb-6">
            <UserAvatar
              user={user}
              name={`${formData.firstName} ${formData.lastName}`.trim()}
              size="3xl"
              className="mx-auto border-4 border-[var(--axiom-paper)] ring-0 axiom-avatar-pop"
            />
          </div>
          <div className="p-5 space-y-1.5">
            <p className="axiom-eyebrow text-primary">Your portrait</p>
            <p className="text-sm text-muted-foreground font-sans leading-relaxed">
              Drawn for you from your account, so you look the same to every judge, opponent and organiser on AXIOM.
            </p>
          </div>
        </NeoCard>
        <NeoCard className="p-5 axiom-rise" style={{"--i": 3}} aria-label="Profile completeness">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-heading font-bold text-base text-foreground">Profile strength</h2>
            <span className="text-xs font-heading font-semibold text-muted-foreground">{completeness.done} of {completeness.total}</span>
          </div>
          <NeoProgressBar label="Profile strength" value={(completeness.done / completeness.total) * 100} showPercentage={false} className="mb-4" />
          <ul className="grid gap-2 text-sm font-sans">
            {completeness.items.map((item) => (
              <li key={item.label} className={`axiom-check-row ${item.ok ? "is-ok" : ""}`}>
                <span aria-hidden="true">{item.ok ? "✓" : "○"}</span>
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">Judges and organisers see your name and college. Your mobile number is used only for round announcements.</p>
        </NeoCard>
        </div>
      )}
      </div>
    </div>
  );
}
