import {dashboardRoutes} from "./lib/dashboardRoutes";
import {lazy, Suspense, useState} from "react";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
const MainLayout = lazy(() => import("./layouts/MainLayout"));
const WorkspaceProviders = lazy(() => import("./components/WorkspaceProviders"));
const Placeholder = lazy(() => import("./pages/Placeholder"));
const Home = lazy(() => import("./pages/Home"));
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const DashboardHome = lazy(dashboardRoutes.home);
const DashboardEvents = lazy(dashboardRoutes.events);
const EventDetails = lazy(dashboardRoutes.event);
const Profile = lazy(dashboardRoutes.profile);
const Participants = lazy(dashboardRoutes.participants);
const RoundDetails = lazy(dashboardRoutes.round);
const Results = lazy(dashboardRoutes.results);
import {OnboardingGuard} from "./components/OnboardingGuard";
const ProfileCompletionGuard = lazy(() => import("./components/ProfileCompletionGuard").then(module => ({
    default: module.ProfileCompletionGuard,
})));
import {AuthRedirectHandler} from "./components/AuthRedirectHandler";
import {AuthenticateWithRedirectCallback} from "./auth/client.jsx";
import ApiAuthSync from "./components/ApiAuthSync";
import PageMetadata from "./components/PageMetadata";

import LandingPage from "./pages/LandingPage";

// Admin imports
import {AdminGuard} from "./components/AdminGuard";
import KeepQueryRedirect from "./components/ops/KeepQueryRedirect";
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminEventProvider = lazy(() => import("./contexts/AdminEventProvider"));
const AdminLive = lazy(() => import("./pages/admin/AdminLive"));
const AdminSetup = lazy(() => import("./pages/admin/setup/AdminSetup"));
const AdminPeople = lazy(() => import("./pages/admin/AdminPeople"));
const AdminResults = lazy(() => import("./pages/admin/AdminResults"));
const AdminDisplay = lazy(() => import("./pages/admin/AdminDisplay"));
const AdminRoundManagement = lazy(() => import("./pages/admin/AdminRoundManagement"));
const AdminResultSubmission = lazy(() => import("./pages/admin/AdminResultSubmission"));
const AdminPromotion = lazy(() => import("./pages/admin/AdminPromotion"));
const AdminPlaceholder = lazy(() => import("./pages/admin/AdminPlaceholder"));

// Public judge e-ballot and participant venue check-in
const PublicBallot = lazy(() => import("./pages/ballot/PublicBallot"));
const VenueCheckIn = lazy(() => import("./pages/checkin/VenueCheckIn"));
import ResumePendingReturn from "./pages/checkin/ResumePendingReturn";
import Preloader from "./components/Preloader";
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
import {VercelAnalytics} from "./components/analytics/VercelAnalytics";

function App() {
    const [showIntro] = useState(() => window.location.pathname !== "/");
    return (
        <>
            {showIntro && <Preloader />}
                <ApiAuthSync />
                <BrowserRouter>
                    <PageMetadata />
                    <ResumePendingReturn />
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

                        {/* Judge e-ballot: public, no account, outside every guard and layout */}
                        <Route path="/ballot/:token" element={<PublicBallot />} />

                        {/* Public Routes with Navbar */}
                        <Route element={<MainLayout />}>
                            <Route
                                path="/about"
                                element={<Home />}
                            />
                        </Route>

                        <Route element={<WorkspaceProviders />}>
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

                        {/* Venue check-in from the Display QR: participant sign-in required (handled inside) */}
                        <Route path="/checkin/:roundId" element={<VenueCheckIn />} />

                        {/* Projector Display: admin-only, full screen, no organiser chrome */}
                        <Route
                            path="/admin/display"
                            element={
                                <AdminGuard>
                                    <AdminEventProvider>
                                        <AdminDisplay />
                                    </AdminEventProvider>
                                </AdminGuard>
                            }
                        />

                        {/* Admin Routes - Protected. Five places: Live · Setup · People · Results · Display */}
                        <Route
                            path="/admin"
                            element={
                                <AdminGuard>
                                    <AdminLayout />
                                </AdminGuard>
                            }
                        >
                            <Route index element={<AdminLive />} />
                            <Route path="setup" element={<AdminSetup />} />
                            <Route path="setup/:id" element={<AdminSetup />} />
                            <Route path="people" element={<AdminPeople />} />
                            <Route path="results" element={<AdminResults />} />
                            <Route path="results/:id" element={<AdminResultSubmission />} />
                            <Route path="rounds/:id" element={<AdminRoundManagement />} />
                            <Route path="rounds/:id/promotion" element={<AdminPromotion />} />

                            {/* Retired URLs redirect into the five places (query kept) */}
                            <Route path="overview" element={<KeepQueryRedirect to="/admin/setup" />} />
                            <Route path="events" element={<KeepQueryRedirect to="/admin/setup" />} />
                            <Route path="events/:id" element={<KeepQueryRedirect to="/admin/setup/:id" />} />
                            <Route path="rounds" element={<KeepQueryRedirect to="/admin/setup" />} />
                            <Route path="rooms" element={<KeepQueryRedirect to="/admin/setup?tab=rooms" />} />
                            <Route path="participants" element={<KeepQueryRedirect to="/admin/people?tab=registry" />} />
                            <Route path="leaderboard" element={<KeepQueryRedirect to="/admin/results?tab=standings" />} />

                            <Route
                                path="settings"
                                element={
                                    <AdminPlaceholder title="Admin Settings" />
                                }
                            />
                        </Route>
                        </Route>
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                    </Suspense>
                </BrowserRouter>
        </>
    );
}

export default App;
//checking
