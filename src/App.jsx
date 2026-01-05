import {BrowserRouter, Routes, Route} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import Placeholder from "./pages/Placeholder";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import DashboardEvents from "./pages/dashboard/DashboardEvents";
import EventDetails from "./pages/dashboard/EventDetails";
import Profile from "./pages/dashboard/Profile";
import Leaderboard from "./pages/dashboard/Leaderboard";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import {OnboardingGuard} from "./components/OnboardingGuard";

// Role selection pages
import RoleSelectPage from "./pages/RoleSelectPage";
import LoginSelectPage from "./pages/LoginSelectPage";

// Admin imports
import {AdminGuard} from "./components/AdminGuard";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes */}
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route
                        path="/events"
                        element={<Placeholder title="Tournaments" />}
                    />
                    <Route
                        path="/about"
                        element={<Placeholder title="About Axiom" />}
                    />

                    {/* Role selection routes */}
                    <Route path="/get-started" element={<RoleSelectPage />} />
                    <Route path="/login-select" element={<LoginSelectPage />} />

                    {/* Clerk auth routes - need wildcard for SSO callbacks */}
                    <Route path="/sign-in/*" element={<SignInPage />} />
                    <Route path="/sign-up/*" element={<SignUpPage />} />
                </Route>

                {/* Dashboard Routes - Protected (User) */}
                <Route
                    path="/dashboard"
                    element={
                        <OnboardingGuard>
                            <DashboardLayout />
                        </OnboardingGuard>
                    }
                >
                    <Route index element={<DashboardHome />} />
                    <Route path="events" element={<DashboardEvents />} />
                    <Route path="events/:id" element={<EventDetails />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route
                        path="settings"
                        element={<Placeholder title="Settings" />}
                    />
                </Route>

                {/* Admin Routes - Protected */}
                <Route
                    path="/admin"
                    element={
                        <AdminGuard>
                            <AdminLayout />
                        </AdminGuard>
                    }
                >
                    <Route index element={<AdminDashboard />} />
                    <Route path="events" element={<AdminEvents />} />
                    <Route
                        path="events/:id"
                        element={<AdminPlaceholder title="Event Details" />}
                    />
                    <Route
                        path="rounds"
                        element={<AdminPlaceholder title="Round Management" />}
                    />
                    <Route
                        path="participants"
                        element={<AdminPlaceholder title="Participants" />}
                    />
                    <Route
                        path="rooms"
                        element={<AdminPlaceholder title="Room Management" />}
                    />
                    <Route
                        path="results"
                        element={<AdminPlaceholder title="Results & Scores" />}
                    />
                    <Route
                        path="settings"
                        element={<AdminPlaceholder title="Admin Settings" />}
                    />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
