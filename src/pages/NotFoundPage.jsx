import {Link} from "react-router-dom";

export default function NotFoundPage() {
    return (
        <main className="min-h-[70vh] flex items-center justify-center px-6 py-16 text-center">
            <div className="max-w-lg">
                <p className="axiom-eyebrow mb-3">404 / Round not found</p>
                <h1 className="mb-3 font-heading text-4xl font-bold">This page isn’t on the draw.</h1>
                <p className="mb-7 text-muted-foreground">The link may be old, or the page may have moved. Return to AXIOM and choose an available event.</p>
                <div className="flex flex-wrap justify-center gap-3">
                    <Link className="axiom-button axiom-button--green" to="/login-select">Go to sign in</Link>
                    <Link className="axiom-button axiom-button--outline" to="/about">About AXIOM</Link>
                </div>
            </div>
        </main>
    );
}
