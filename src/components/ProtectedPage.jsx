import {useUser, useAuth} from "../auth/client.jsx";
import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {UserApi} from "../services/api";

function ProtectedPage() {
    const {user} = useUser();
    const {signOut} = useAuth();
    const navigate = useNavigate();
    const [backendUserData, setBackendUserData] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate("/");
        console.log("User logged out successfully");
    };

    const fetchBackendUser = async () => {
        try {
            setLoading(true);
            const response = await UserApi.getProfile();
            setBackendUserData(response.user);
        } catch (error) {
            console.error("Error fetching user from backend:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{padding: "2rem", textAlign: "center"}}>
            <h1>🎉 Welcome to the Protected Page!</h1>
            <p>
                Hello,{" "}
                {user?.firstName || user?.emailAddresses[0]?.emailAddress}!
            </p>
            <p>You are signed in to your AXIOM account.</p>

            <div
                style={{
                    marginTop: "2rem",
                    padding: "1rem",
                    background: "#1a1a1a",
                    borderRadius: "8px",
                }}
            >
                <h3>Your Profile Information (Frontend):</h3>
                <p>
                    <strong>Email:</strong>{" "}
                    {user?.emailAddresses[0]?.emailAddress}
                </p>
                <p>
                    <strong>Phone:</strong>{" "}
                    {user?.phoneNumbers[0]?.phoneNumber || "Not provided"}
                </p>
                <p>
                    <strong>Name:</strong> {user?.fullName}
                </p>
                <p>
                    <strong>User ID:</strong> {user?.id}
                </p>
                <p>
                    <strong>Profile Image:</strong> <br />
                    <img
                        src={user?.imageUrl}
                        alt="Profile"
                        style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            marginTop: "10px",
                        }}
                    />
                </p>
            </div>

            <div
                style={{
                    marginTop: "2rem",
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "center",
                }}
            >
                <button
                    onClick={fetchBackendUser}
                    disabled={loading}
                    style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        background: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading
                        ? "Loading..."
                        : "Fetch User from Backend (Check Console)"}
                </button>

                <button
                    onClick={handleLogout}
                    style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                    }}
                >
                    🚪 Logout
                </button>
            </div>

            {backendUserData && (
                <div
                    style={{
                        marginTop: "2rem",
                        padding: "1rem",
                        background: "#e3f2fd",
                        borderRadius: "8px",
                    }}
                >
                    <h3>Backend User Data:</h3>
                    <p>
                        <strong>Email:</strong> {backendUserData.email}
                    </p>
                    <p>
                        <strong>Phone:</strong>{" "}
                        {backendUserData.phone || "Not provided"}
                    </p>
                    <p>
                        <strong>Name:</strong> {backendUserData.fullName}
                    </p>
                    <p>
                        <strong>Last Sign In:</strong>{" "}
                        {new Date(
                            backendUserData.lastSignInAt
                        ).toLocaleString()}
                    </p>
                    <p>
                        <strong>External Accounts:</strong>
                    </p>
                    <ul style={{listStyle: "none", padding: 0}}>
                        {backendUserData.externalAccounts?.map(
                            (account, index) => (
                                <li key={index}>
                                    {account.provider} - {account.emailAddress}
                                </li>
                            )
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default ProtectedPage;
