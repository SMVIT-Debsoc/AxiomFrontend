import {Construction} from "lucide-react";

export default function AdminPlaceholder({title}) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                <Construction className="w-10 h-10 text-purple-500" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            <p className="text-muted-foreground max-w-md">
                This admin feature is coming soon. We're working hard to bring
                you the best experience.
            </p>
        </div>
    );
}
