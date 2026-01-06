import {useState, useEffect} from "react";
import {useUser, useAuth} from "@clerk/clerk-react";
import {useNavigate, useLocation} from "react-router-dom";
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
import {useToast} from "../../components/ui/Toast";

export default function Profile({isOnboarding = false}) {
    const {user, isLoaded} = useUser();
    const {getToken} = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
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
                            dbUser?.mobile ||
                            user.primaryPhoneNumber?.phoneNumber ||
                            "",
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
                    const eventsResponse = await EventApi.list(
                        token,
                        "ONGOING"
                    );
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
                                await CheckInApi.checkIn(
                                    ongoingRound.id,
                                    token
                                );
                                toast.success(
                                    "Registered Successfully! 🎉",
                                    `You have been registered for ${currentEvent.name} and checked in!`
                                );
                            } catch (checkInError) {
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
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );

    const isProfileComplete = formData.college && formData.mobile;

    return (
        <div className="max-w-2xl mx-auto px-4">
            {/* Onboarding Header */}
            {isOnboarding && (
                <div className="mb-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCircle className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">
                        Complete Your Profile
                    </h1>
                    <p className="text-muted-foreground">
                        Please fill in your details to register for the event
                    </p>
                </div>
            )}

            {/* Regular Header */}
            {!isOnboarding && (
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">My Profile</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your personal information and tournament
                        identity.
                    </p>
                </div>
            )}

            {success && !isOnboarding && (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-bold">Success!</span> Your profile has
                    been saved to the database.
                </div>
            )}
            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            {!isOnboarding && !isProfileComplete && (
                <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <span className="font-bold">Action Required</span>
                        <p className="text-sm">
                            Please complete your College and Mobile Number to
                            access all features.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                {/* Banner/Header */}
                <div className="bg-[#6D28D9] p-4 text-white flex items-center gap-3">
                    <img
                        src={user.imageUrl}
                        alt="Profile"
                        className="w-14 h-14 rounded-full border-2 border-white/20 object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold truncate">
                            {formData.firstName} {formData.lastName}
                        </h2>
                        <p className="opacity-80 text-sm truncate">
                            {user.primaryEmailAddress?.emailAddress}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />{" "}
                                First Name
                            </label>
                            <input
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="Jane"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />{" "}
                                Last Name
                            </label>
                            <input
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <School className="w-4 h-4 text-muted-foreground" />{" "}
                            College / Institution
                            {isOnboarding && (
                                <span className="text-red-500">*</span>
                            )}
                        </label>
                        <input
                            name="college"
                            value={formData.college}
                            onChange={handleChange}
                            required={isOnboarding}
                            className={`w-full bg-background border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                                isOnboarding && !formData.college
                                    ? "border-amber-500/50"
                                    : "border-border"
                            }`}
                            placeholder="e.g. Harvard University"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />{" "}
                            Mobile Number
                            {isOnboarding && (
                                <span className="text-red-500">*</span>
                            )}
                        </label>
                        <input
                            name="mobile"
                            value={formData.mobile}
                            onChange={handleChange}
                            required={isOnboarding}
                            className={`w-full bg-background border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                                isOnboarding && !formData.mobile
                                    ? "border-amber-500/50"
                                    : "border-border"
                            }`}
                            placeholder="+1 234 567 890"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Hash className="w-4 h-4 text-muted-foreground" />{" "}
                                USN / Student ID
                                <span className="text-xs text-muted-foreground">
                                    (Optional)
                                </span>
                            </label>
                            <input
                                name="usn"
                                value={formData.usn}
                                onChange={handleChange}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="e.g. 1MS22CS001"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />{" "}
                                Email (Read Only)
                            </label>
                            <input
                                disabled
                                value={
                                    user.primaryEmailAddress?.emailAddress || ""
                                }
                                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-muted-foreground cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Gender Field - Optional */}
                    {!isOnboarding && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />{" "}
                                Gender
                                <span className="text-xs text-muted-foreground">
                                    (Optional)
                                </span>
                            </label>
                            <select
                                name="gender"
                                value={formData.gender || ""}
                                onChange={handleChange}
                                className="w-full max-w-xs bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer appearance-none"
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

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={
                                saving ||
                                (isOnboarding &&
                                    (!formData.college || !formData.mobile))
                            }
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {isOnboarding
                                ? "Complete Profile & Register"
                                : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
