import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { User, Mail, School, Hash, Save, Loader2, Phone } from 'lucide-react';
import { UserApi } from '../../services/api';

export default function Profile() {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        college: '',
        usn: '',
        mobile: ''
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isLoaded && user) {
            // In a real app, we would fetch the profile from our backend DB 
            // which might have more fields than Clerk (like College/USN)
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                college: user.publicMetadata?.college || '',
                usn: user.publicMetadata?.usn || '',
                mobile: user.publicMetadata?.mobile || user.primaryPhoneNumber?.phoneNumber || ''
            });
        }
    }, [isLoaded, user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setSuccess(false);
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const token = await getToken();

            // Sync with Backend
            await UserApi.updateProfile({
                firstName: formData.firstName,
                lastName: formData.lastName,
                college: formData.college,
                usn: formData.usn,
                mobile: formData.mobile
            }, token);

            // Ensure we update Clerk metadata if we are using it for storage
            await user.update({
                firstName: formData.firstName,
                lastName: formData.lastName,
                publicMetadata: {
                    college: formData.college,
                    usn: formData.usn,
                    mobile: formData.mobile
                }
            });

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to update profile", error);
            setError("Failed to save changes. Please try again later.");
        } finally {
            setSaving(false);
        }
    };

    if (!isLoaded) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="max-w-2xl mx-auto">
            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}
            <div className="mb-8">
                <h1 className="text-3xl font-bold">My Profile</h1>
                {!user.publicMetadata?.college && (
                    <div className="mt-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-lg flex items-center gap-3">
                        <span className="font-bold">⚠️ Action Required</span>
                        Please complete your profile to access all features.
                    </div>
                )}
                <p className="text-muted-foreground mt-1">Manage your personal information and tournament identity.</p>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                {/* Banner/Header */}
                <div className="bg-[#6D28D9] p-6 text-white flex items-center gap-4">
                    <img
                        src={user.imageUrl}
                        alt="Profile"
                        className="w-20 h-20 rounded-full border-4 border-white/20 object-cover"
                    />
                    <div>
                        <h2 className="text-xl font-bold">
                            {formData.firstName} {formData.lastName}
                        </h2>
                        <p className="opacity-80">{user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" /> First Name
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
                                <User className="w-4 h-4 text-muted-foreground" /> Last Name
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
                            <School className="w-4 h-4 text-muted-foreground" /> College / Institution
                        </label>
                        <input
                            name="college"
                            value={formData.college}
                            onChange={handleChange}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            placeholder="e.g. Harvard University"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Hash className="w-4 h-4 text-muted-foreground" /> USN / Student ID
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
                                <Mail className="w-4 h-4 text-muted-foreground" /> Email (Read Only)
                            </label>
                            <input
                                disabled
                                value={user.primaryEmailAddress?.emailAddress || ''}
                                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-muted-foreground cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" /> Mobile Number
                        </label>
                        <input
                            name="mobile"
                            value={formData.mobile}
                            onChange={handleChange}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            placeholder="+1 234 567 890"
                        />
                    </div>

                    <div className="pt-4 flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>

                        {success && (
                            <span className="text-green-500 text-sm font-medium animate-in fade-in slide-in-from-left-2">
                                Profile updated successfully!
                            </span>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
