import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Placeholder from "./pages/Placeholder";
import Home from "./pages/Home";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import DashboardEvents from "./pages/dashboard/DashboardEvents";
import EventDetails from "./pages/dashboard/EventDetails";
import Profile from "./pages/dashboard/Profile";
import Participants from "./pages/dashboard/Participants";
import RoundDetails from "./pages/dashboard/RoundDetails";
import Results from "./pages/dashboard/Results";
import {OnboardingGuard} from "./components/OnboardingGuard";
import {ProfileCompletionGuard} from "./components/ProfileCompletionGuard";
import {AuthRedirectHandler} from "./components/AuthRedirectHandler";
import ApiAuthSync from "./components/ApiAuthSync";
import {ToastProvider} from "./components/ui/Toast";

import LandingPage from "./pages/LandingPage";

// Admin imports
import {AdminGuard} from "./components/AdminGuard";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminEventDetails from "./pages/admin/AdminEventDetails";
import AdminRoundManagement from "./pages/admin/AdminRoundManagement";
import AdminRounds from "./pages/admin/AdminRounds";
import AdminResultSubmission from "./pages/admin/AdminResultSubmission";
import AdminPromotion from "./pages/admin/AdminPromotion";

import AdminResults from "./pages/admin/AdminResults";
import AdminLeaderboard from "./pages/admin/AdminLeaderboard";
import AdminParticipants from "./pages/admin/AdminParticipants";

import AdminRooms from "./pages/admin/AdminRooms";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import Preloader from "./components/Preloader";
import NotFoundPage from "./pages/NotFoundPage";
import {VercelAnalytics} from "./components/analytics/VercelAnalytics";

function App() {
    return (
        <>
            <Preloader />
            <ToastProvider>
                <ApiAuthSync />
                <BrowserRouter>
                    <VercelAnalytics />
                    <Routes>
                        {/* Auth redirect handler - processes admin/user routing after sign-in */}
                        <Route
                            path="/auth-redirect"
                            element={<AuthRedirectHandler />}
                        />

                        {/* Landing: Google-only registration / sign-in */}
                        <Route path="/" element={<LandingPage />} />

                        {/* Legacy auth URLs: kept so old links land on the landing page */}
                        {["/login-select", "/sign-in/*", "/sign-up/*", "/forgot-password", "/reset-password", "/get-started"].map((path) => (
                            <Route key={path} path={path} element={<Navigate to="/" replace />} />
                        ))}

                        {/* Public Routes with Navbar */}
                        <Route element={<MainLayout />}>
                            <Route
                                path="/about"
                                element={<Home />}
                            />
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
                            <Route
                                path="events"
                                element={<DashboardEvents />}
                            />
                            <Route
                                path="events/:id"
                                element={<EventDetails />}
                            />
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
                                path="rounds/:id/promotion"
                                element={<AdminPromotion />}
                            />

                            <Route
                                path="participants"
                                element={<AdminParticipants />}
                            />

                            <Route path="rooms" element={<AdminRooms />} />

                            <Route path="leaderboard" element={<AdminLeaderboard />} />

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
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </BrowserRouter>
            </ToastProvider>
        </>
    );
}

export default App;
//checking
