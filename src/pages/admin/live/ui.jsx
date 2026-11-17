import {Link} from "react-router-dom";
import {X} from "lucide-react";
import ModalSurface from "../../../components/ui/ModalSurface";
import {cn} from "../../../lib/utils";

export function EmptyBlock({title, body, to, cta}) {
    return (
        <div className="ax-card mx-auto mt-10 max-w-lg p-8 text-center">
            <h1 className="font-display text-4xl font-normal text-primary">{title}</h1>
            <p className="mb-5 mt-2 text-muted-foreground text-sm">{body}</p>
            {to && <Link to={to} className="ax-primary-btn">{cta}</Link>}
        </div>
    );
}

/** Big number with a label. Bebas Neue + tabular numbers. */
export function Stat({label, value, of, className}) {
    return (
        <div className={cn("rounded-2xl bg-muted/60 p-3.5 border border-border/50", className)}>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
            <p className="m-0 mt-1 font-display text-3xl leading-none text-primary tabular-nums">
                {value}{of != null && <span className="font-sans text-xs text-muted-foreground"> / {of}</span>}
            </p>
        </div>
    );
}

/** Segmented control; each option is a ≥44px target. */
export function Segmented({options, value, onChange, label, className}) {
    return (
        <div role="tablist" aria-label={label} className={cn("inline-flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1", className)}>
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="tab"
                    aria-selected={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn(
                        "min-h-11 flex-1 rounded-lg px-3 text-xs font-bold transition-colors sm:flex-none",
                        value === o.value ? "bg-card text-foreground shadow-xs border border-border/70" : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

/**
 * Side sheet on laptops, bottom sheet on phones (axiom-dialog mobile rules).
 * Native <dialog> (top layer): open only ModalSurface-based dialogs from inside it.
 */
export function SideSheet({title, subtitle, onClose, children, footer, wide = false, label}) {
    return (
        <ModalSurface
            onDismiss={onClose}
            aria-label={label || title}
            className="flex items-end bg-transparent p-0 sm:items-stretch sm:justify-end"
        >
            <div className={cn(
                "flex w-full flex-col bg-card text-foreground shadow-2xl border-border sm:h-full sm:!max-h-[100dvh] sm:border-l rounded-t-2xl sm:rounded-none",
                wide ? "sm:w-[min(760px,100vw)]" : "sm:w-[min(520px,100vw)]",
            )}>
                <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                        <h2 className="m-0 font-heading text-lg font-bold leading-tight">{title}</h2>
                        {subtitle && <p className="m-0 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
                {footer && (
                    <div className="border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5">{footer}</div>
                )}
            </div>
        </ModalSurface>
    );
}

export function StateDot({state}) {
    return <span aria-hidden="true" className={cn("ax-state-dot", `ax-state-${state}`)} />;
}
