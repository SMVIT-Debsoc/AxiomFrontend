import {Outlet} from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function MainLayout() {
    return (
        <div className="axiom-public-shell bg-background text-foreground">
            <a className="axiom-skip" href="#main-content">Skip to content</a>
            <Navbar />
            <main id="main-content">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
