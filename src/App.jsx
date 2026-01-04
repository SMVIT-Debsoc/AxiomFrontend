import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import {SignedIn, SignedOut} from "@clerk/clerk-react";
import HomePage from "./components/HomePage";
import ProtectedPage from "./components/ProtectedPage";
import "./App.css";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route
                    path="/protected"
                    element={
                        <>
                            <SignedIn>
                                <ProtectedPage />
                            </SignedIn>
                            <SignedOut>
                                <Navigate to="/" replace />
                            </SignedOut>
                        </>
                    }
                />
            </Routes>
        </Router>
    );
}

export default App;
