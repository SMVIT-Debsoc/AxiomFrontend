/**
 * Generated profile pictures for AXIOM 4.0.
 *
 * Every account without its own photo gets a small sculptural portrait drawn from the brand
 * palette: a halo (prabha) behind a stylised bust with a headdress, jewellery and drapery, in the
 * manner of the Indian goddess sculpture used across the identity. The result is a pure function
 * of the seed (email, id or name), so the same person looks the same everywhere without storage.
 *
 * Variety: 12 palettes x 8 halos x 8 headdresses x 6 jewellery sets x 4 drapery x 3 face shapes
 * x 3 expressions x 4 backdrops x 2 orientations = 1,327,104 distinct portraits.
 */

const PALETTES = [
  {bg: "#87C14D", halo: "#A2CF75", figure: "#171B16", accent: "#EFEEE8"},
  {bg: "#171B16", halo: "#36571C", figure: "#EFEEE8", accent: "#87C14D"},
  {bg: "#EFEEE8", halo: "#87C14D", figure: "#171B16", accent: "#6CA038"},
  {bg: "#6CA038", halo: "#87C14D", figure: "#EFEEE8", accent: "#171B16"},
  {bg: "#A2CF75", halo: "#EFEEE8", figure: "#171B16", accent: "#36571C"},
  {bg: "#36571C", halo: "#6CA038", figure: "#FAFAF6", accent: "#A2CF75"},
  {bg: "#FAFAF6", halo: "#A2CF75", figure: "#36571C", accent: "#87C14D"},
  {bg: "#2C3A2A", halo: "#87C14D", figure: "#EFEEE8", accent: "#A2CF75"},
  {bg: "#87C14D", halo: "#171B16", figure: "#FAFAF6", accent: "#171B16"},
  {bg: "#EFEEE8", halo: "#171B16", figure: "#6CA038", accent: "#FAFAF6"},
  {bg: "#6CA038", halo: "#36571C", figure: "#171B16", accent: "#EFEEE8"},
  {bg: "#171B16", halo: "#87C14D", figure: "#EFEEE8", accent: "#171B16"},
];

/** FNV-1a. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Independent pick from a bag of bits: each feature mixes the seed with its own salt. */
function pick(seed, salt, count) {
  return hash(`${salt}:${seed}`) % count;
}

function ring(n, radius, make) {
  return Array.from({length: n}, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return make(32 + Math.cos(a) * radius, 30 + Math.sin(a) * radius, a);
  }).join("");
}

function backdrop(variant, c) {
  switch (variant) {
    case 1: // dotted field
      return `<g fill="${c.halo}" opacity=".35">${[8, 24, 40, 56].map((x) => [10, 28, 46, 60].map((y) => `<circle cx="${x + (y % 2 ? 0 : 8)}" cy="${y}" r="1.3"/>`).join("")).join("")}</g>`;
    case 2: // diagonal weave
      return `<g stroke="${c.halo}" stroke-width="1.2" opacity=".35">${[-48, -32, -16, 0, 16, 32, 48].map((o) => `<path d="M${o} 64 L${o + 64} 0"/>`).join("")}</g>`;
    case 3: // rising arcs
      return `<g fill="none" stroke="${c.halo}" stroke-width="1.4" opacity=".4"><circle cx="32" cy="66" r="22"/><circle cx="32" cy="66" r="32"/><circle cx="32" cy="66" r="42"/></g>`;
    default:
      return "";
  }
}

function halo(variant, c) {
  switch (variant) {
    case 0:
      return `<circle cx="32" cy="30" r="23" fill="${c.halo}"/>`;
    case 1:
      return `<circle cx="32" cy="30" r="22" fill="none" stroke="${c.halo}" stroke-width="4"/><circle cx="32" cy="30" r="15" fill="${c.halo}" opacity=".45"/>`;
    case 2:
      return `<g stroke="${c.halo}" stroke-width="2.4" stroke-linecap="round">${ring(16, 15, (x1, y1, a) => `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${(32 + Math.cos(a) * 27).toFixed(2)}" y2="${(30 + Math.sin(a) * 27).toFixed(2)}"/>`)}</g><circle cx="32" cy="30" r="15" fill="${c.halo}"/>`;
    case 3:
      return `<g fill="${c.halo}">${ring(12, 19, (x, y) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.6"/>`)}<circle cx="32" cy="30" r="19"/></g>`;
    case 4: // mandorla (pointed almond) behind the whole figure
      return `<path d="M32 0 C54 14 54 46 32 64 C10 46 10 14 32 0 Z" fill="${c.halo}"/>`;
    case 5: // lotus petals
      return `<g fill="${c.halo}">${ring(8, 16, (x, y, a) => `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="4" ry="11" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})"/>`)}<circle cx="32" cy="30" r="15"/></g>`;
    case 6: // beaded ring
      return `<circle cx="32" cy="30" r="21" fill="${c.halo}" opacity=".35"/><g fill="${c.halo}">${ring(20, 21, (x, y) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.9"/>`)}</g>`;
    default: // double concentric
      return `<circle cx="32" cy="30" r="24" fill="${c.halo}" opacity=".45"/><circle cx="32" cy="30" r="17" fill="${c.halo}"/>`;
  }
}

/** Returns {behind, above}: hair that sits behind the face and ornament above it. */
function headdress(variant, c) {
  switch (variant) {
    case 0: // tiered crown
      return {above: `<path d="M22.5 25 L23.5 13 L27.5 18.5 L32 8 L36.5 18.5 L40.5 13 L41.5 25 Z" fill="${c.accent}"/><path d="M22.5 25 L41.5 25 L41 27.5 L23 27.5 Z" fill="${c.figure}"/>`};
    case 1: // high bun
      return {above: `<circle cx="32" cy="12.5" r="6" fill="${c.figure}"/><path d="M22.4 28 C21.5 15 42.5 15 41.6 28 C38 21.5 26 21.5 22.4 28 Z" fill="${c.figure}"/><circle cx="32" cy="12.5" r="2" fill="${c.accent}"/>`};
    case 2: // long parted hair
      return {behind: `<path d="M21 52 C16 38 17 15 32 15 C47 15 48 38 43 52 L40.5 52 C42 40 41 29 38 25 C35 23 29 23 26 25 C23 29 22 40 23.5 52 Z" fill="${c.figure}"/>`};
    case 3: // lotus crown
      return {above: `<g fill="${c.accent}"><ellipse cx="32" cy="14.5" rx="3.2" ry="7"/><ellipse cx="25.5" cy="17.5" rx="3" ry="6.2" transform="rotate(-28 25.5 17.5)"/><ellipse cx="38.5" cy="17.5" rx="3" ry="6.2" transform="rotate(28 38.5 17.5)"/></g><path d="M22.4 27 C23 22 41 22 41.6 27 C38 24.8 26 24.8 22.4 27 Z" fill="${c.figure}"/>`};
    case 4: // jata mukuta: tall tapered knot with bands
      return {above: `<path d="M24 26 C23 16 27 5 32 3 C37 5 41 16 40 26 Z" fill="${c.figure}"/><g stroke="${c.accent}" stroke-width="1.3" fill="none"><path d="M25.5 21 H38.5"/><path d="M26.5 15.5 H37.5"/><path d="M28 10 H36"/></g>`};
    case 5: // side braid over the shoulder
      return {behind: `<path d="M36 22 C42 28 46 40 44 56 C43.5 60 40.5 60 40.5 56 C41.5 44 38 34 34 27 Z" fill="${c.figure}"/>`, above: `<path d="M22.4 28 C21 16 43 16 41.6 28 C38 22 26 22 22.4 28 Z" fill="${c.figure}"/><circle cx="42" cy="58" r="2.2" fill="${c.accent}"/>`};
    case 6: // fan crown: five rays above a close cap
      return {above: `<g fill="${c.accent}">${[-48, -24, 0, 24, 48].map((deg) => `<path d="M32 24 L29.6 10 Q32 7 34.4 10 Z" transform="rotate(${deg} 32 24)"/>`).join("")}</g><path d="M22.4 28 C21.5 16 42.5 16 41.6 28 C38 22 26 22 22.4 28 Z" fill="${c.figure}"/>`};
    default: // tiara with centre gem
      return {above: `<path d="M22.4 28 C21.5 16 42.5 16 41.6 28 C38 22 26 22 22.4 28 Z" fill="${c.figure}"/><path d="M23 22.5 Q32 14.5 41 22.5" fill="none" stroke="${c.accent}" stroke-width="1.8" stroke-linecap="round"/><path d="M32 12 L35 17 L32 22 L29 17 Z" fill="${c.accent}"/>`};
  }
}

function jewellery(variant, c) {
  const bindi = `<circle cx="32" cy="25.4" r="1.25" fill="${c.accent}"/>`;
  const earrings = `<circle cx="22.2" cy="34.5" r="2" fill="${c.accent}"/><circle cx="41.8" cy="34.5" r="2" fill="${c.accent}"/>`;
  const drops = `<g fill="${c.accent}"><path d="M22.2 33 v5"/><path d="M21 38 L22.2 42 L23.4 38 Z"/><path d="M41.8 33 v5"/><path d="M40.6 38 L41.8 42 L43 38 Z"/></g><path d="M22.2 33 v5 M41.8 33 v5" stroke="${c.accent}" stroke-width="1"/>`;
  const necklace = `<path d="M21 52 Q32 63 43 52" fill="none" stroke="${c.accent}" stroke-width="1.8" stroke-linecap="round"/><circle cx="32" cy="58.2" r="1.9" fill="${c.accent}"/>`;
  const collar = `<path d="M23 50.5 Q32 56 41 50.5" fill="none" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round"/><path d="M25 55 Q32 60 39 55" fill="none" stroke="${c.accent}" stroke-width="1.4" stroke-linecap="round"/>`;
  const maangTikka = `<path d="M32 18.5 V25" stroke="${c.accent}" stroke-width="1" /><circle cx="32" cy="26.4" r="1.5" fill="${c.accent}"/>`;
  const beads = `<g fill="${c.accent}">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<circle cx="${(23 + i * 3).toFixed(1)}" cy="${(50.5 + Math.sin((i / 6) * Math.PI) * 4.5).toFixed(1)}" r="1.2"/>`).join("")}</g>`;
  return [
    bindi + earrings + necklace,
    bindi + earrings + collar,
    bindi + necklace,
    earrings + collar,
    maangTikka + drops + beads,
    bindi + drops + necklace + collar,
  ][variant];
}

function drapery(variant, c) {
  const base = `<path d="M9 64 C9 50.5 19 46 32 46 C45 46 55 50.5 55 64 Z" fill="${c.figure}"/>`;
  switch (variant) {
    case 1: // sash across the chest
      return base + `<path d="M13 56 L47 46.8 L52 50 L16 64 Z" fill="${c.accent}" opacity=".85"/>`;
    case 2: // scalloped neckline
      return base + `<g fill="${c.bg}" opacity=".9">${[0, 1, 2, 3].map((i) => `<circle cx="${(24.5 + i * 5).toFixed(1)}" cy="49.5" r="2.6"/>`).join("")}</g>`;
    case 3: // pleats
      return base + `<g stroke="${c.accent}" stroke-width="1" opacity=".55">${[16, 22, 28, 36, 42, 48].map((x) => `<path d="M${x} 64 V54"/>`).join("")}</g>`;
    default:
      return base;
  }
}

function face(variant, c) {
  const rx = [9.2, 8.2, 10.2][variant];
  const ry = [11.2, 12.2, 10.6][variant];
  return `<ellipse cx="32" cy="30.5" rx="${rx}" ry="${ry}" fill="${c.figure}"/>`;
}

function eyes(variant, c) {
  const stroke = `stroke="${c.bg}" stroke-width="1.15" fill="none" stroke-linecap="round"`;
  switch (variant) {
    case 1: // open
      return `<g fill="${c.bg}"><ellipse cx="28.4" cy="30.4" rx="1.5" ry="1.2"/><ellipse cx="35.6" cy="30.4" rx="1.5" ry="1.2"/></g><path d="M30.2 35.6 q1.8 1.2 3.6 0" ${stroke}/>`;
    case 2: // half-lidded, serene
      return `<path d="M26.2 30.2 h4.4 M33.4 30.2 h4.4" ${stroke}/><path d="M29.4 35.4 q2.6 1.5 5.2 0" ${stroke}/>`;
    default: // closed, smiling
      return `<path d="M26.4 30.6 q2 -1.6 4 0 M33.6 30.6 q2 -1.6 4 0" ${stroke}/>`;
  }
}

/** @param {string} seed */
export function avatarSvg(seed) {
  const key = String(seed || "axiom").trim().toLowerCase();
  const c = PALETTES[pick(key, "palette", PALETTES.length)];
  const hair = headdress(pick(key, "headdress", 8), c);
  const flip = pick(key, "flip", 2) === 1;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<rect width="64" height="64" fill="${c.bg}"/>
${backdrop(pick(key, "backdrop", 4), c)}
<g${flip ? ' transform="translate(64 0) scale(-1 1)"' : ""}>
${halo(pick(key, "halo", 8), c)}
${hair.behind || ""}
${drapery(pick(key, "drapery", 4), c)}
<rect x="28.4" y="37" width="7.2" height="11" rx="2" fill="${c.figure}"/>
${face(pick(key, "face", 3), c)}
${eyes(pick(key, "eyes", 3), c)}
${hair.above || ""}
${jewellery(pick(key, "jewellery", 6), c)}
</g>
</svg>`;
}

/** `data:` URI usable as an `<img src>`, a CSS image, or rasterised for upload. */
export function avatarDataUri(seed) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(seed).replace(/\n/g, ""))}`;
}

/** Clerk serves a generic placeholder (`{"type":"default"...}` base64) when no photo was uploaded. */
export function hasRealPhoto(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("data:")) return true;
  return !/img\.clerk\.(com|dev)\/eyJ0eXBlIjoiZGVmYXVsdCI/.test(url);
}

/** Stable identity for a user-like object coming from Clerk, the API, or the temporary session. */
export function avatarSeed(user, fallbackName = "") {
  return (
    user?.primaryEmailAddress?.emailAddress ||
    user?.email ||
    user?.emailAddress ||
    user?.id ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    fallbackName ||
    "axiom"
  );
}

/** Rasterise the generated avatar to a PNG blob (for Clerk's setProfileImage). */
export async function avatarPngBlob(seed, size = 512) {
  const image = new Image();
  image.decoding = "async";
  image.src = avatarDataUri(seed);
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d").drawImage(image, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Avatar rasterisation failed"))), "image/png"),
  );
}
