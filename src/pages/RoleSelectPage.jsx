import {useState} from "react";
import {useNavigate} from "react-router-dom";
import Sculpture from "../components/brand/Sculpture";
import RoleAccess from "../components/brand/RoleAccess";

export default function RoleSelectPage() {
    const navigate = useNavigate();
    const [showSecretKeyInput, setShowSecretKeyInput] = useState(false);
    const [secretKey, setSecretKey] = useState("");
    const [error, setError] = useState("");

    const handleRoleSelect = (role) => {
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

        // Store secret key in localStorage (persists across OAuth redirects)
        localStorage.setItem("adminSecretKey", secretKey);
        localStorage.setItem("pendingRole", "admin");

        // Navigate to sign-up with admin role
        navigate("/sign-up?role=admin");
    };

    return (
        <section className="axiom-registration axiom-container">
            <div className="axiom-registration-intro">
                <p className="axiom-eyebrow">AXIOM 4.0 / Take your place</p>
                <h1>A considered voice.<br />A competitive edge.</h1>
                <p className="max-w-md text-muted-foreground">Choose your role to enter the tournament workspace. Debaters follow their rounds; organizers bring the arena together.</p>
                <div className="axiom-registration-art"><Sculpture /><span>Articulate.<br />Reason. Compose.</span></div>
            </div>
            <div className="axiom-registration-panel">
                <RoleAccess
                    registration
                    showSecretKeyInput={showSecretKeyInput}
                    secretKey={secretKey}
                    setSecretKey={setSecretKey}
                    error={error}
                    onRoleSelect={handleRoleSelect}
                    onAdminContinue={handleAdminContinue}
                    onBack={() => { setShowSecretKeyInput(false); setSecretKey(""); setError(""); }}
                />
            </div>
        </section>
    );
}
