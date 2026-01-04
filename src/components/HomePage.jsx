import {
    SignInButton,
    SignedIn,
    SignedOut,
    UserButton,
} from "@clerk/clerk-react";
import {Link} from "react-router-dom";
import {useClerk} from "@clerk/clerk-react";

function HomePage() {
    const {signOut} = useClerk();

    const handleLogout = async () => {
        await signOut();
        console.log("User logged out successfully");
    };

    return (
        <div style={{padding: "2rem", textAlign: "center"}}>
            <h1>Welcome to Axiom</h1>

            <SignedOut>
                <div style={{marginTop: "2rem"}}>
                    <p>Please sign in to access protected content</p>
                    <SignInButton mode="modal">
                        <button
                            style={{
                                padding: "10px 20px",
                                fontSize: "16px",
                                background: "#4285f4",
                                color: "white",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                                marginTop: "1rem",
                            }}
                        >
                            Sign in with Google
                        </button>
                    </SignInButton>
                </div>
            </SignedOut>

            <SignedIn>
                <div style={{marginTop: "2rem"}}>
                    <UserButton afterSignOutUrl="/" />
                    <div
                        style={{
                            marginTop: "2rem",
                            display: "flex",
                            gap: "1rem",
                            justifyContent: "center",
                        }}
                    >
                        <Link to="/protected">
                            <button
                                style={{
                                    padding: "10px 20px",
                                    fontSize: "16px",
                                    background: "#28a745",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "5px",
                                    cursor: "pointer",
                                }}
                            >
                                Go to Protected Page
                            </button>
                        </Link>
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
                </div>
            </SignedIn>
        </div>
    );
}

export default HomePage;
