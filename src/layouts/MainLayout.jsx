import {Outlet} from "react-router-dom";
import Footer from "../components/Footer";

export default function MainLayout() {
    return (
        <div className="min-h-screen flex flex-col font-sans antialiased text-foreground bg-background selection:bg-primary/30">
            <div className="fixed inset-0 z-[-1]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-background to-background"></div>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
            </div>
            <main className="flex-1">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
