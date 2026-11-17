import {cn} from "../../lib/utils";

// Shared header + ?tab= tabs for the Setup / People / Results areas, so every
// area reads the same: eyebrow (event), Bebas title, one primary action slot.

export function AreaHeader({eyebrow, title, description, actions, className}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="m-0 truncate text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="font-display text-[44px] font-normal leading-[0.95] text-primary md:text-[56px]">{title}</h1>
        {description && <p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function AreaTabs({tabs, active, onChange, label, className}) {
  const onKeyDown = (event) => {
    const index = tabs.findIndex((t) => t.key === active);
    let next = null;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
    if (!next) return;
    event.preventDefault();
    onChange(next.key);
    window.requestAnimationFrame(() => document.getElementById(`area-tab-${next.key}`)?.focus());
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn("mb-4 flex w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-muted/60 p-1 sm:inline-flex sm:w-auto", className)}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            id={`area-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors sm:flex-none",
              selected ? "border border-border bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon && <tab.icon size={16} aria-hidden="true" />}
            <span>{tab.label}</span>
            {tab.count != null && <span className="tabular-nums text-xs text-muted-foreground">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
