import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {motion} from "framer-motion";
import {User, Shield, ArrowRight, Key, AlertCircle} from "lucide-react";

export default function LoginSelectPage() {
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState(null);
    const [showSecretKeyInput, setShowSecretKeyInput] = useState(false);
    const [secretKey, setSecretKey] = useState("");
    const [error, setError] = useState("");

    const handleRoleSelect = (role) => {
        setSelectedRole(role);
        setError("");

        if (role === "admin") {
            setShowSecretKeyInput(true);
        } else {
            // Navigate to user sign-in
            navigate("/sign-in?role=user");
        }
    };

    const handleAdminContinue = () => {
        if (!secretKey.trim()) {
            setError("Please enter the admin secret key");
            return;
        }

        // Store secret key in session storage for later verification
        sessionStorage.setItem("adminSecretKey", secretKey);
        sessionStorage.setItem("pendingRole", "admin");

        // Navigate to sign-in with admin role
        navigate("/sign-in?role=admin");
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
                    <p className="text-muted-foreground">
                        {showSecretKeyInput
                            ? "Enter your admin secret key to continue"
                            : "Select your role to sign in"}
                    </p>
                </div>

                {!showSecretKeyInput ? (
                    <div className="space-y-4">
                        {/* User Role Card */}
                        <motion.button
                            whileHover={{scale: 1.02}}
                            whileTap={{scale: 0.98}}
                            onClick={() => handleRoleSelect("user")}
                            className={`w-full p-6 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                                selectedRole === "user"
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50 bg-card"
                            }`}
                        >
                            <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <User className="w-7 h-7 text-blue-500" />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className="text-lg font-bold">
                                    Sign in as Debater
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Access your debates and stats
                                </p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </motion.button>

                        {/* Admin Role Card */}
                        <motion.button
                            whileHover={{scale: 1.02}}
                            whileTap={{scale: 0.98}}
                            onClick={() => handleRoleSelect("admin")}
                            className={`w-full p-6 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                                selectedRole === "admin"
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50 bg-card"
                            }`}
                        >
                            <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <Shield className="w-7 h-7 text-purple-500" />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className="text-lg font-bold">
                                    Sign in as Admin
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Manage the platform
                                </p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </motion.button>
                    </div>
                ) : (
                    <motion.div
                        initial={{opacity: 0, x: 20}}
                        animate={{opacity: 1, x: 0}}
                        className="space-y-6"
                    >
                        <div className="bg-card border border-border rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Key className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold">Admin Access</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Enter secret key to continue
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-500 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <input
                                type="password"
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                placeholder="Enter admin secret key"
                                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                onKeyDown={(e) =>
                                    e.key === "Enter" && handleAdminContinue()
                                }
                            />

                            <button
                                onClick={handleAdminContinue}
                                className="w-full mt-4 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                            >
                                Continue to Sign In
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setShowSecretKeyInput(false);
                                setSelectedRole(null);
                                setSecretKey("");
                                setError("");
                            }}
                            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            ← Back to role selection
                        </button>
                    </motion.div>
                )}

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Don't have an account?{" "}
                    <button
                        onClick={() => navigate("/get-started")}
                        className="text-primary hover:underline"
                    >
                        Get started
                    </button>
                </p>
            </motion.div>
        </div>
    );
}
