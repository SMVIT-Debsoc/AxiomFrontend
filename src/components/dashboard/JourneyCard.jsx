import {Link} from "react-router-dom";
import {Check, ArrowRight} from "lucide-react";
import {cn} from "../../lib/utils";
import NeoProgressBar from "../neo/NeoProgressBar";

/**
 * Four-step checklist from "profile" to "first debate". Steps are {title, hint, done, to}. The next
 * unfinished step is highlighted so there is always one obvious thing to do.
 */
export default function JourneyCard({steps, className}) {
  const completed = steps.filter((step) => step.done).length;
  const nextIndex = steps.findIndex((step) => !step.done);
  return (
    <section className={cn("bg-card rounded-xl p-5 axiom-rise", className)} style={{"--i": 4}} aria-labelledby="journey-title">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="journey-title" className="font-heading font-bold text-base text-foreground">Your journey</h2>
        <span className="text-xs font-heading font-semibold text-muted-foreground">{completed} of {steps.length}</span>
      </div>
      <NeoProgressBar label="Journey progress" value={(completed / steps.length) * 100} showPercentage={false} className="mb-4" />
      <ol className="grid gap-2.5">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Link
              to={step.to}
              className={cn("axiom-journey-step", step.done && "is-done", index === nextIndex && "is-next")}
              aria-current={index === nextIndex ? "step" : undefined}
            >
              <span className="axiom-journey-mark" aria-hidden="true">
                {step.done ? <Check size={16} strokeWidth={3} /> : index + 1}
              </span>
              <span className="min-w-0">
                <strong>{step.title}</strong>
                <small>{step.done ? "Done" : step.hint}</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" className="ml-auto shrink-0" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
