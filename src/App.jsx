import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import DashboardEvents from './pages/dashboard/DashboardEvents';
import EventDetails from './pages/dashboard/EventDetails';
import Profile from './pages/dashboard/Profile';
import Leaderboard from './pages/dashboard/Leaderboard';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import { OnboardingGuard } from './components/OnboardingGuard';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes */}
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/events" element={<Placeholder title="Tournaments" />} />
                    <Route path="/about" element={<Placeholder title="About Axiom" />} />
                    <Route path="/sign-in" element={<SignInPage />} />
                    <Route path="/sign-up" element={<SignUpPage />} />
                </Route>

                {/* Dashboard Routes - Protected */}
                <Route path="/dashboard" element={
                    <OnboardingGuard>
                        <DashboardLayout />
                    </OnboardingGuard>
                }>
                    <Route index element={<DashboardHome />} />
                    <Route path="events" element={<DashboardEvents />} />
                    <Route path="events/:id" element={<EventDetails />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="leaderboard" element={<Leaderboard />} />
                    <Route path="settings" element={<Placeholder title="Settings" />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
