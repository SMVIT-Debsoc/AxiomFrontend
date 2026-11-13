import {lazy, Suspense} from "react";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
const Placeholder = lazy(() => import("./pages/Placeholder"));
const Home = lazy(() => import("./pages/Home"));
import DashboardLayout from "./layouts/DashboardLayout";
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const DashboardEvents = lazy(() => import("./pages/dashboard/DashboardEvents"));
const EventDetails = lazy(() => import("./pages/dashboard/EventDetails"));
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const Participants = lazy(() => import("./pages/dashboard/Participants"));
const RoundDetails = lazy(() => import("./pages/dashboard/RoundDetails"));
const Results = lazy(() => import("./pages/dashboard/Results"));
import {OnboardingGuard} from "./components/OnboardingGuard";
import {ProfileCompletionGuard} from "./components/ProfileCompletionGuard";
import {AuthRedirectHandler} from "./components/AuthRedirectHandler";
import {AuthenticateWithRedirectCallback} from "./auth/client.jsx";
import ApiAuthSync from "./components/ApiAuthSync";
import {ToastProvider} from "./components/ui/Toast";

import LandingPage from "./pages/LandingPage";

// Admin imports
import {AdminGuard} from "./components/AdminGuard";
import AdminLayout from "./layouts/AdminLayout";
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminLive = lazy(() => import("./pages/admin/AdminLive"));
const AdminPeople = lazy(() => import("./pages/admin/AdminPeople"));
const AdminEvents = lazy(() => import("./pages/admin/AdminEvents"));
const AdminEventDetails = lazy(() => import("./pages/admin/AdminEventDetails"));
const AdminRoundManagement = lazy(() => import("./pages/admin/AdminRoundManagement"));
const AdminRounds = lazy(() => import("./pages/admin/AdminRounds"));
const AdminResultSubmission = lazy(() => import("./pages/admin/AdminResultSubmission"));
const AdminPromotion = lazy(() => import("./pages/admin/AdminPromotion"));

const AdminResults = lazy(() => import("./pages/admin/AdminResults"));
const AdminLeaderboard = lazy(() => import("./pages/admin/AdminLeaderboard"));
const AdminParticipants = lazy(() => import("./pages/admin/AdminParticipants"));

const AdminRooms = lazy(() => import("./pages/admin/AdminRooms"));
const AdminPlaceholder = lazy(() => import("./pages/admin/AdminPlaceholder"));
import Preloader from "./components/Preloader";
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
import {VercelAnalytics} from "./components/analytics/VercelAnalytics";

function App() {
    return (
        <>
            <Preloader />
            <ToastProvider>
                <ApiAuthSync />
                <BrowserRouter>
                    <VercelAnalytics />
                    <Suspense fallback={<div className="min-h-svh bg-background" role="status" aria-label="Loading" />}>
                    <Routes>
                        {/* Clerk SSO callback handler - exchanges OAuth code and establishes session */}
                        <Route
                            path="/sso-callback"
                            element={
                                <AuthenticateWithRedirectCallback
                                    signInForceRedirectUrl="/auth-redirect"
                                    signUpForceRedirectUrl="/auth-redirect"
                                />
                            }
                        />

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
                                    <Profile isOnboarding />
                                </OnboardingGuard>
                            }
                        />

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
                            <Route index element={<AdminLive />} />
                            <Route path="overview" element={<AdminDashboard />} />
                            <Route path="people" element={<AdminPeople />} />
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
                    </Suspense>
                </BrowserRouter>
            </ToastProvider>
        </>
    );
}

export default App;
//checking
