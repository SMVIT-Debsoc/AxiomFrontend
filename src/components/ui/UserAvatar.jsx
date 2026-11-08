import {useEffect, useId, useMemo, useRef, useState} from "react";
import {cn} from "../../lib/utils";
import {avatarSeed, hasRealPhoto} from "../../lib/avatar";

const sizes = {
  xs: {className: "w-6 h-6", px: 24},
  sm: {className: "w-8 h-8", px: 32},
  md: {className: "w-10 h-10", px: 40},
  lg: {className: "w-12 h-12", px: 48},
  xl: {className: "w-16 h-16", px: 64},
  "2xl": {className: "w-24 h-24", px: 96},
  "3xl": {className: "w-32 h-32", px: 128},
};

// Brand-only palettes: blob, face ink, cheek, backdrop tint.
const PALETTES = [
  {blob: "#B9F5D8", ink: "#141510", cheek: "#9FE3C2", back: "#D4EDE1"},
  {blob: "#1D1E18", ink: "#EAFBF5", cheek: "#B9F5D8", back: "#CFE9DD"},
  {blob: "#9FE3C2", ink: "#141510", cheek: "#EAFBF5", back: "#DAF1E6"},
  {blob: "#4A5646", ink: "#EAFBF5", cheek: "#9FE3C2", back: "#CAE5D8"},
  {blob: "#EAFBF5", ink: "#1D1E18", cheek: "#B9F5D8", back: "#B0CFBE"},
  {blob: "#D4EDE1", ink: "#1D1E18", cheek: "#B9F5D8", back: "#B9F5D8"},
];
const BLOBS = [
  "M50 10C72 8 92 26 90 50C88 76 70 92 48 90C26 88 10 72 10 50C10 28 28 12 50 10Z",
  "M52 8C76 12 92 30 88 54C84 78 66 92 44 88C22 84 8 66 12 44C16 22 34 6 52 8Z",
  "M50 9C70 6 94 28 91 52C88 74 72 94 48 91C24 88 8 70 10 48C12 26 30 12 50 9Z",
  "M46 10C70 6 90 22 91 46C92 72 72 92 48 90C24 88 6 74 9 50C12 28 24 12 46 10Z",
];
const SMILES = ["M40 62Q50 69 60 62", "M41 63Q50 67 59 61", "M39 61Q50 68 61 63"];
const MOODS = ["happy", "wow", "wink"];

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const pick = (seed, salt, n) => hash(`${salt}:${seed}`) % n;

/* One shared pointer listener for every large avatar: eyes look toward the cursor. Updates go straight
   to CSS variables (no React renders) and are batched into one animation frame. */
const watchers = new Set();
let frame = 0;
let pointer = null;
function flush() {
  frame = 0;
  if (!pointer) return;
  watchers.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const dx = pointer.x - (r.left + r.width / 2);
    const dy = pointer.y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160);
    el.style.setProperty("--axa-lx", String((dx / d) * 3 * k));
    el.style.setProperty("--axa-ly", String((dy / d) * 3 * k));
  });
}
function onPointer(event) {
  pointer = {x: event.clientX, y: event.clientY};
  if (!frame) frame = requestAnimationFrame(flush);
}
function watch(el) {
  if (watchers.size === 0) {
    window.addEventListener("pointermove", onPointer, {passive: true});
    window.addEventListener("pointerdown", onPointer, {passive: true});
  }
  watchers.add(el);
  return () => {
    watchers.delete(el);
    if (watchers.size === 0) {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    }
  };
}

function Face({seed, px}) {
  const uid = useId().replace(/:/g, "");
  const p = PALETTES[pick(seed, "pal", PALETTES.length)];
  const blob = BLOBS[pick(seed, "blob", BLOBS.length)];
  const smile = SMILES[pick(seed, "smile", SMILES.length)];
  const sprout = pick(seed, "sprout", 3) !== 0;
  const shades = pick(seed, "shades", 3) === 0;
  const brows = !shades && pick(seed, "brows", 2) === 0;
  const blinkDelay = `${(pick(seed, "blink", 40) / 10).toFixed(1)}s`;
  const showCheeks = px >= 40;
  const eye = (cx, side) => (
    <g className={`axa-eye axa-eye-${side}`}>
      <g className="axa-pupil axa-dot">
        <ellipse className="axa-dot-body" cx={cx} cy="49" rx="3.8" ry="4.8" fill={p.ink} />
        <circle cx={cx + 1.3} cy="47.2" r="1.3" fill="#fff" opacity=".85" />
      </g>
      <path className="axa-arc" d={`M${cx - 6} 51Q${cx} 43 ${cx + 6} 51`} fill="none" stroke={p.ink} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" className="axa-svg" style={{"--axa-blink": blinkDelay}}>
      <defs>
        <radialGradient id={`g${uid}`} cx="35%" cy="28%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={p.back} />
      <g className="axa-body">
        {sprout && <path d="M50 16Q47 5 38 5Q40 15 50 17M50 16Q55 3 64 5Q62 14 50 17" fill="#B9F5D8" stroke="#141510" strokeOpacity=".35" strokeWidth="1" strokeLinejoin="round" />}
        <path d={blob} fill={p.blob} />
        <path d={blob} fill={`url(#g${uid})`} />
        {showCheeks && <><ellipse cx="30" cy="61" rx="5" ry="3.2" fill={p.cheek} opacity=".5" /><ellipse cx="70" cy="61" rx="5" ry="3.2" fill={p.cheek} opacity=".5" /></>}
        {brows && <g className="axa-brows" fill="none" stroke={p.ink} strokeWidth="2.4" strokeLinecap="round"><path d="M31 39Q37 36 43 38" /><path d="M57 38Q63 36 69 39" /></g>}
        {shades ? (
          <g className="axa-shades">
            <path d="M24 47L28 46M72 46L76 47" stroke={p.ink} strokeWidth="2.6" strokeLinecap="round" />
            <rect x="28" y="40" width="21" height="14" rx="6.5" fill={p.ink} />
            <rect x="51" y="40" width="21" height="14" rx="6.5" fill={p.ink} />
            <path d="M48 45Q50 43.5 52 45" stroke={p.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <g className="axa-glare" stroke="#fff" strokeLinecap="round" opacity=".5"><path d="M33 44L37 44" strokeWidth="2" /><path d="M56 44L60 44" strokeWidth="2" /></g>
          </g>
        ) : (
          <g className="axa-eyes">{eye(38, "l")}{eye(62, "r")}</g>
        )}
        <path className="axa-m axa-m-idle" d={smile} fill="none" stroke={p.ink} strokeWidth="2.8" strokeLinecap="round" />
        <path className="axa-m axa-m-happy" d="M36 60Q50 76 64 60" fill="none" stroke={p.ink} strokeWidth="3.2" strokeLinecap="round" />
        <ellipse className="axa-m axa-m-wow" cx="50" cy="66" rx="3.6" ry="4.4" fill={p.ink} />
      </g>
    </svg>
  );
}

/**
 * Profile picture. A person's own photo is shown when they have one; otherwise a small character
 * generated from their email/id/name (same person, same face, everywhere; no storage, no network).
 * The character blinks, its eyes follow the cursor (48px and larger), it smiles on hover, and a tap
 * or click makes it pop and change expression. All of that is decorative, so the avatar stays an
 * image for assistive tech and never takes focus.
 */
export function UserAvatar({user, name, imageUrl, className = "", size = "md"}) {
  const [failedUrl, setFailedUrl] = useState(null);
  const [mood, setMood] = useState("idle");
  const [popKey, setPopKey] = useState(0);
  const root = useRef(null);
  const inner = useRef(null);
  const timer = useRef(0);
  const clicks = useRef(0);
  const displayName = name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Participant";
  const photo = imageUrl || user?.imageUrl;
  const usePhoto = hasRealPhoto(photo) && photo !== failedUrl;
  const seed = avatarSeed(user, displayName);
  const {className: sizeClass, px} = sizes[size] || sizes.md;
  const tracks = !usePhoto && px >= 48;

  useEffect(() => {
    const node = root.current;
    if (!tracks || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    return watch(node);
  }, [tracks]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const react = () => {
    clicks.current += 1;
    setMood(MOODS[(clicks.current - 1) % MOODS.length]);
    setPopKey((k) => k + 1);
    // Web Animations API, not a remount: replacing the touched element mid-tap would cancel the click
    // of any button or link that contains the avatar.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      inner.current?.animate(
        [{transform: "scale(1)"}, {transform: "scale(1.2, .84)", offset: 0.3}, {transform: "scale(.92, 1.12)", offset: 0.6}, {transform: "scale(1)"}],
        {duration: 520, easing: "cubic-bezier(.3, 1.5, .5, 1)"},
      );
    }
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMood("idle"), 1600);
  };
  const face = useMemo(() => <Face seed={seed} px={px} />, [seed, px]);

  return (
    <span
      ref={root}
      className={cn("axa relative inline-flex shrink-0 select-none", sizeClass, className)}
      data-mood={mood}
      data-photo={usePhoto ? "true" : "false"}
      onPointerDown={react}
      role="img"
      aria-label={displayName}
    >
      <span ref={inner} className="axa-pop absolute inset-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        {usePhoto ? (
          <img
            src={photo}
            alt=""
            width={px}
            height={px}
            className="h-full w-full object-cover"
            onError={() => setFailedUrl(photo)}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : face}
      </span>
      {popKey > 0 && <span key={`r${popKey}`} aria-hidden="true" className="axa-ring" />}
    </span>
  );
}
