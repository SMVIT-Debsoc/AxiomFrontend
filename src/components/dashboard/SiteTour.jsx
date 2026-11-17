import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {matchPath, useLocation, useNavigate} from "react-router-dom";
import {preloadDashboardRoute} from "../../lib/dashboardRoutes";
import {GUIDE_STEPS, getStepCopy, readTourProgress, writeTourProgress} from "../../lib/visualGuide";
import TourExample from "./TourExample";
import "./siteTour.css";

const anchor = (id) => document.querySelector(`[data-tour-anchor="${id}"]`);

function tournamentLink(preferredPath) {
  const links = [...document.querySelectorAll('[data-tour-anchor="event-link"]')];
  return links.find((link) => link.pathname === preferredPath) || links[0];
}

export default function SiteTour({userId, requested, launcher}) {
  const [saved, setSaved] = useState(() => readTourProgress(userId));
  const [screenState, setScreen] = useState(null);
  const [handledRequest, setHandledRequest] = useState(0);
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const [exampleHost, setExampleHost] = useState(null);
  const [ready, setReady] = useState(false);
  const [destination, setDestination] = useState("/dashboard");
  const eventPath = useRef(null);
  const heading = useRef(null);
  const panel = useRef(null);
  const navigate = useNavigate();
  const {pathname} = useLocation();
  const step = GUIDE_STEPS[index];
  const screen = requested === handledRequest ? screenState : "welcome";

  function save(progress) {
    setSaved(progress);
    writeTourProgress(userId, progress);
  }

  function goTo(nextIndex) {
    const next = GUIDE_STEPS[nextIndex];
    const link = anchor("active-event") || tournamentLink(eventPath.current);
    if (link) eventPath.current = link.pathname;
    const currentRound = next.round && matchPath("/dashboard/events/:eventId/rounds/:roundId", pathname);
    const path = (next.id === "enrollment" && eventPath.current) || (currentRound && pathname) || next.path;
    setPosition((previous) => previous && {...previous, settled: false});
    setExampleHost(null);
    setIndex(nextIndex);
    setDestination(path);
    setHandledRequest(requested);
    setScreen("step");
    save(next.id);
    if (pathname !== path) navigate(path);
  }

  function close(progress) {
    if (progress) save(progress);
    setHandledRequest(requested);
    setScreen(null);
    launcher.current?.focus({preventScroll: true});
  }

  useEffect(() => {
    if (saved || screen || pathname !== "/dashboard" || ready) return;
    const timer = window.setInterval(() => {
      const checkIn = anchor("check-in");
      if (anchor("overview") && document.querySelector("[data-tour-whatsapp-ready]") &&
          !document.getElementById("whatsapp-community-modal-title") &&
          (checkIn?.dataset.tourWindow !== "OPEN" || checkIn.dataset.tourState === "present")) {
        setReady(true);
        setScreen("invite");
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [pathname, ready, saved, screen]);

  useEffect(() => {
    if (!screen) return;
    heading.current?.focus({preventScroll: true});
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || document.getElementById("whatsapp-community-modal-title")) return;
      event.preventDefault();
      if (screen !== "step" && !saved) {
        setSaved("dismissed");
        writeTourProgress(userId, "dismissed");
      }
      setHandledRequest(requested);
      setScreen(null);
      launcher.current?.focus({preventScroll: true});
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, index, saved, userId, launcher, requested]);

  useEffect(() => {
    if (screen !== "step") return;
    let lastTarget;
    let lastPosition;
    let scrollGoal;
    let scrollDeadline;
    let preloadedPath;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const started = Date.now();
    const measure = () => {
      if (document.getElementById("whatsapp-community-modal-title")) {
        setPosition((previous) => previous?.settled ? {...previous, settled: false} : previous);
        lastPosition = null;
        return;
      }
      const onDestination = pathname === destination;
      const eventLink = onDestination && step.id === "enrollment" && pathname === step.path && tournamentLink(eventPath.current);
      if (eventLink) {
        const path = eventLink.pathname;
        eventPath.current = path;
        setDestination(path);
        navigate(path);
        return;
      }
      const tab = onDestination && pathname === step.path && step.tab && anchor(`tab-${step.tab}`);
      if (tab && tab.getAttribute("aria-selected") !== "true") {
        tab.click();
        return;
      }
      const roundLink = tab && step.round && anchor("rounds");
      if (roundLink) {
        const path = roundLink.pathname;
        setDestination(path);
        navigate(path);
        return;
      }
      const exact = onDestination
        ? step.id === "events" ? tournamentLink(eventPath.current)
          : step.round && pathname === step.path ? null : anchor(step.id)
        : null;
      const roundHeader = onDestination && step.round && anchor("round-header");
      if (!exact && roundHeader?.dataset?.tourLoading === "true" && Date.now() - started < 3500) return;
      const host = !exact && onDestination ? document.querySelector(`[data-tour-slot="${step.id}"]`) : null;
      setExampleHost(host);
      const example = host?.firstElementChild;
      if (host && !example) {
        setPosition((previous) => previous?.settled ? {...previous, settled: false} : previous);
        return;
      }
      const target = exact || example;
      const scroller = document.querySelector("[data-tour-scroll]");
      if (scroller && target && target !== lastTarget) {
        const bounds = target.getBoundingClientRect();
        const viewport = scroller.getBoundingClientRect();
        const centered = scroller.scrollTop + bounds.top - viewport.top - (scroller.clientHeight - bounds.height) / 2;
        scrollGoal = Math.max(0, Math.min(centered, scroller.scrollHeight - scroller.clientHeight));
        scrollDeadline = Date.now() + 650;
        scroller.scrollTo({top: scrollGoal, behavior: reducedMotion.matches ? "instant" : "smooth"});
        setPosition((previous) => previous?.settled ? {...previous, settled: false} : previous);
        lastTarget = target;
      }
      if (!target && Date.now() - started < 3500) return;
      if (scroller && target && Math.abs(scroller.scrollTop - scrollGoal) > 2 && Date.now() < scrollDeadline) return;
      const bounds = target?.getBoundingClientRect();
      const scrollBounds = scroller?.getBoundingClientRect();
      const narrow = innerWidth < 768;
      const bottom = innerHeight - (narrow ? 76 : 16);
      const top = Math.max(bounds?.top ?? 0, scrollBounds?.top ?? 0);
      const end = Math.min(bounds?.bottom ?? 0, bottom);
      const height = panel.current?.offsetHeight || 230;
      const visible = end > top + 6;
      const placeAbove = visible && end + height + 14 > bottom && top - height - 14 >= 8;
      const panelTop = visible && end + height + 14 <= bottom
        ? end + 14
        : placeAbove ? top - height - 14 : bottom - height;
      const left = bounds ? Math.max(4, Math.round(bounds.left)) : 0;
      const width = bounds ? Math.min(innerWidth - left - 4, Math.round(bounds.width)) : 0;
      const panelWidth = panel.current?.offsetWidth || 384;
      const center = left + width / 2;
      const panelLeft = narrow ? 12 : Math.max(16, Math.min(center - panelWidth / 2, innerWidth - panelWidth - 16));
      const value = {
        settled: true,
        path: pathname,
        stepId: step.id,
        target: visible ? {top: Math.round(top), height: Math.round(end - top), left, width} : null,
        exact: Boolean(exact && exact.dataset.tourState !== "unassigned"),
        state: example ? host.dataset.tourUnavailable || "example" : exact?.dataset.tourState,
        top: Math.max(8, Math.round(panelTop)),
        left: Math.round(panelLeft),
        arrowX: Math.round(Math.max(20, Math.min(center - panelLeft, panelWidth - 20))),
        above: placeAbove,
      };
      const signature = JSON.stringify(value);
      if (signature !== lastPosition?.signature || target !== lastPosition?.target) {
        lastPosition = {signature, target};
        setPosition(value);
      }
      const next = GUIDE_STEPS[index + 1];
      const nextPath = next && ((next.id === "enrollment" && (tournamentLink(eventPath.current)?.pathname || eventPath.current))
        || (next.round && (anchor("rounds")?.pathname || (step.round && pathname)))
        || next.path);
      if (nextPath && nextPath !== preloadedPath) {
        preloadDashboardRoute(nextPath);
        preloadedPath = nextPath;
      }
    };
    measure();
    const resize = new ResizeObserver(measure);
    if (panel.current) resize.observe(panel.current);
    const timer = window.setInterval(measure, 100);
    return () => {
      resize.disconnect();
      window.clearInterval(timer);
    };
  }, [screen, pathname, destination, step, index, navigate]);

  if (!screen) return null;
  const active = screen === "step";
  const last = index === GUIDE_STEPS.length - 1;
  const resume = GUIDE_STEPS.findIndex(({id}) => id === saved);
  const placed = position?.settled && position.stepId === step.id && position.path === pathname;
  const target = placed && position.target;
  return createPortal(
    <>
      {active && exampleHost?.dataset.tourSlot === step.id && createPortal(<TourExample stepId={step.id} />, exampleHost)}
      {active && position?.target && <div className="site-tour-highlight" style={position.target}
        data-visible={Boolean(target)} aria-hidden="true" data-testid="tour-highlight" />}
      <section
        ref={panel}
        role={active ? "dialog" : "region"}
        aria-labelledby="site-tour-title"
        className="site-tour-panel"
        style={active && position ? {top: position.top, left: position.left} : undefined}
      >
        {target && active && <span
          className={`site-tour-arrow ${position.above ? "site-tour-arrow-down" : ""}`}
          style={{left: position.arrowX}}
          aria-hidden="true"
        />}
        <div className="site-tour-body">
          {active && <p className="text-xs font-semibold text-muted-foreground">Site Tour · {index + 1} of {GUIDE_STEPS.length}</p>}
          <h2 id="site-tour-title" ref={heading} tabIndex={-1} className="text-lg font-heading font-bold">
            {active ? step.title : "Take a tour of AXIOM"}
          </h2>
          <p className="text-sm leading-snug" aria-live="polite" aria-busy={active && !placed}>
            {active
              ? placed ? getStepCopy(step, position.state, position.exact) : "Finding this part of the page…"
              : "Learn how to join a tournament, check in, find your debate room, and see your results."}
          </p>
          <div className="site-tour-actions">
            {active ? (
              <>
                <button type="button" onClick={() => close()}>Exit tour</button>
                {index > 0 && <button type="button" onClick={() => goTo(index - 1)}>Back</button>}
                <button type="button" className="site-tour-primary" disabled={!placed} onClick={() => last ? close("finished") : goTo(index + 1)}>
                  {last ? "Finish" : "Next"}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => close(saved ? undefined : "dismissed")}>Skip for now</button>
                <button type="button" className={resume < 0 ? "site-tour-primary" : undefined} onClick={() => goTo(0)}>
                  {saved && saved !== "dismissed" ? "Restart tour" : "Start tour"}
                </button>
                {resume >= 0 && <button type="button" className="site-tour-primary" onClick={() => goTo(resume)}>Resume tour</button>}
              </>
            )}
          </div>
        </div>
      </section>
    </>,
    document.body,
  );
}
