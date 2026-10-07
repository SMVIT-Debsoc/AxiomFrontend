import { Construction } from "lucide-react";

export default function AdminPlaceholder({ title }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
            <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                <Construction className="w-8 h-8 text-primary" />
            </div>
            <span className="axiom-eyebrow text-emerald-600 dark:text-emerald-400 mb-1">Under Development</span>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-3">{title}</h1>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                This administration feature is scheduled for release in an upcoming milestone. We are crafting a seamless workflow aligned with AXIOM 4.0 specifications.
            </p>
        </div>
    );
}
