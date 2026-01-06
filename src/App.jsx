import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Placeholder from "./pages/Placeholder";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import DashboardEvents from "./pages/dashboard/DashboardEvents";
import EventDetails from "./pages/dashboard/EventDetails";
import Profile from "./pages/dashboard/Profile";
import Leaderboard from "./pages/dashboard/Leaderboard";
import Participants from "./pages/dashboard/Participants";
import RoundDetails from "./pages/dashboard/RoundDetails";
import Results from "./pages/dashboard/Results";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import { OnboardingGuard } from "./components/OnboardingGuard";
import { ProfileCompletionGuard } from "./components/ProfileCompletionGuard";
import { AuthRedirectHandler } from "./components/AuthRedirectHandler";
import { ToastProvider } from "./components/ui/Toast";

// Role selection pages
import RoleSelectPage from "./pages/RoleSelectPage";
import LoginSelectPage from "./pages/LoginSelectPage";

// Admin imports
import { AdminGuard } from "./components/AdminGuard";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminEventDetails from "./pages/admin/AdminEventDetails";
import AdminRoundManagement from "./pages/admin/AdminRoundManagement";
import AdminRounds from "./pages/admin/AdminRounds";
import AdminResultSubmission from "./pages/admin/AdminResultSubmission";

import AdminResults from "./pages/admin/AdminResults";
import AdminParticipants from "./pages/admin/AdminParticipants";

import AdminRooms from "./pages/admin/AdminRooms";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";

function App() {
    return (
        <ToastProvider>
            <BrowserRouter>
                <Routes>
                    {/* Auth redirect handler - processes admin/user routing after sign-in */}
                    <Route
                        path="/auth-redirect"
                        element={<AuthRedirectHandler />}
                    />

                    {/* Root redirects to login-select (Login first approach - no navbar) */}
                    <Route
                        path="/"
                        element={<Navigate to="/login-select" replace />}
                    />

                    {/* Login Select Page - No navbar/footer */}
                    <Route path="/login-select" element={<LoginSelectPage />} />

                    {/* Public Routes with Navbar */}
                    <Route element={<MainLayout />}>
                        <Route
                            path="/about"
                            element={<Placeholder title="About Axiom" />}
                        />

                        {/* Role selection routes */}
                        <Route
                            path="/get-started"
                            element={<RoleSelectPage />}
                        />

                        {/* Clerk auth routes - need wildcard for SSO callbacks */}
                        <Route path="/sign-in/*" element={<SignInPage />} />
                        <Route path="/sign-up/*" element={<SignUpPage />} />
                    </Route>

                    {/* Profile Completion Route - Without ProfileCompletionGuard */}
                    <Route
                        path="/complete-profile"
                        element={
                            <OnboardingGuard>
                                <DashboardLayout />
                            </OnboardingGuard>
                        }
                    >
                        <Route index element={<Profile isOnboarding />} />
                    </Route>

                    {/* Dashboard Routes - Protected (User) */}
                    <Route
                        path="/dashboard"
                        element={
                            <ProfileCompletionGuard>
                                <OnboardingGuard>
                                    <DashboardLayout />
                                </OnboardingGuard>
                            </ProfileCompletionGuard>
                        }
                    >
                        <Route index element={<DashboardHome />} />
                        <Route path="events" element={<DashboardEvents />} />
                        <Route path="events/:id" element={<EventDetails />} />
                        <Route
                            path="events/:eventId/participants"
                            element={<Participants />}
                        />
                        <Route
                            path="events/:eventId/rounds/:roundId"
                            element={<RoundDetails />}
                        />
                        <Route
                            path="events/:eventId/results"
                            element={<Results />}
                        />
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
                            element={<AdminEventDetails />}
                        />

                        <Route path="rounds" element={<AdminRounds />} />
                        <Route
                            path="rounds/:id"
                            element={<AdminRoundManagement />}
                        />

                        <Route
                            path="participants"
                            element={<AdminParticipants />}
                        />

                        <Route path="rooms" element={<AdminRooms />} />

                        <Route path="results" element={<AdminResults />} />
                        <Route
                            path="results/:id"
                            element={<AdminResultSubmission />}
                        />

                        <Route
                            path="settings"
                            element={
                                <AdminPlaceholder title="Admin Settings" />
                            }
                        />
                    </Route>
                </Routes>
            </BrowserRouter>
        </ToastProvider>
    );
}

export default App;
