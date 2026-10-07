/**
 * Generated profile pictures for AXIOM 4.0.
 *
 * Every account without its own photo gets a small sculptural portrait drawn from the brand
 * palette: a halo (prabha) behind a stylised bust with a headdress and jewellery, in the manner
 * of the Indian goddess sculpture used across the identity. The result is a pure function of
 * the seed (email, id or name), so the same person looks the same everywhere without storage.
 */

const PALETTES = [
  {bg: "#87C14D", halo: "#A2CF75", figure: "#171B16", accent: "#EFEEE8"},
  {bg: "#171B16", halo: "#36571C", figure: "#EFEEE8", accent: "#87C14D"},
  {bg: "#EFEEE8", halo: "#87C14D", figure: "#171B16", accent: "#6CA038"},
  {bg: "#6CA038", halo: "#87C14D", figure: "#EFEEE8", accent: "#171B16"},
  {bg: "#A2CF75", halo: "#EFEEE8", figure: "#171B16", accent: "#36571C"},
  {bg: "#36571C", halo: "#6CA038", figure: "#FAFAF6", accent: "#A2CF75"},
];

/** FNV-1a, enough entropy for a handful of design choices. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function halo(variant, c) {
  switch (variant) {
    case 0:
      return `<circle cx="32" cy="30" r="23" fill="${c.halo}"/>`;
    case 1:
      return `<circle cx="32" cy="30" r="22" fill="none" stroke="${c.halo}" stroke-width="4"/><circle cx="32" cy="30" r="15" fill="${c.halo}" opacity=".45"/>`;
    case 2: {
      const rays = Array.from({length: 16}, (_, i) => {
        const a = (i * Math.PI * 2) / 16;
        const x1 = 32 + Math.cos(a) * 15;
        const y1 = 30 + Math.sin(a) * 15;
        const x2 = 32 + Math.cos(a) * 27;
        const y2 = 30 + Math.sin(a) * 27;
        return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
      }).join("");
      return `<g stroke="${c.halo}" stroke-width="2.4" stroke-linecap="round">${rays}</g><circle cx="32" cy="30" r="15" fill="${c.halo}"/>`;
    }
    default: {
      const petals = Array.from({length: 12}, (_, i) => {
        const a = (i * Math.PI * 2) / 12;
        return `<circle cx="${(32 + Math.cos(a) * 19).toFixed(2)}" cy="${(30 + Math.sin(a) * 19).toFixed(2)}" r="4.6"/>`;
      }).join("");
      return `<g fill="${c.halo}">${petals}<circle cx="32" cy="30" r="19"/></g>`;
    }
  }
}

function headdress(variant, c) {
  switch (variant) {
    case 0: // tiered crown
      return `<path d="M22.5 25 L23.5 13 L27.5 18.5 L32 8 L36.5 18.5 L40.5 13 L41.5 25 Z" fill="${c.accent}"/><path d="M22.5 25 L41.5 25 L41 27.5 L23 27.5 Z" fill="${c.figure}"/>`;
    case 1: // high bun
      return `<circle cx="32" cy="12.5" r="6" fill="${c.figure}"/><path d="M22.4 28 C21.5 15 42.5 15 41.6 28 C38 21.5 26 21.5 22.4 28 Z" fill="${c.figure}"/><circle cx="32" cy="12.5" r="2" fill="${c.accent}"/>`;
    case 2: // long parted hair
      return `<path d="M21 52 C16 38 17 15 32 15 C47 15 48 38 43 52 L40.5 52 C42 40 41 29 38 25 C35 23 29 23 26 25 C23 29 22 40 23.5 52 Z" fill="${c.figure}"/>`;
    default: // lotus crown
      return `<g fill="${c.accent}"><ellipse cx="32" cy="14.5" rx="3.2" ry="7"/><ellipse cx="25.5" cy="17.5" rx="3" ry="6.2" transform="rotate(-28 25.5 17.5)"/><ellipse cx="38.5" cy="17.5" rx="3" ry="6.2" transform="rotate(28 38.5 17.5)"/></g><path d="M22.4 27 C23 22 41 22 41.6 27 C38 24.8 26 24.8 22.4 27 Z" fill="${c.figure}"/>`;
  }
}

function jewellery(variant, c) {
  const bindi = `<circle cx="32" cy="25.4" r="1.25" fill="${c.accent}"/>`;
  const earrings = `<circle cx="22.2" cy="34.5" r="2" fill="${c.accent}"/><circle cx="41.8" cy="34.5" r="2" fill="${c.accent}"/>`;
  const necklace = `<path d="M21 52 Q32 63 43 52" fill="none" stroke="${c.accent}" stroke-width="1.8" stroke-linecap="round"/><circle cx="32" cy="58.2" r="1.9" fill="${c.accent}"/>`;
  const collar = `<path d="M23 50.5 Q32 56 41 50.5" fill="none" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round"/><path d="M25 55 Q32 60 39 55" fill="none" stroke="${c.accent}" stroke-width="1.4" stroke-linecap="round"/>`;
  return [bindi + earrings + necklace, bindi + earrings + collar, bindi + necklace, earrings + collar][variant];
}

/** @param {string} seed */
export function avatarSvg(seed) {
  const h = hash(String(seed || "axiom").trim().toLowerCase());
  const c = PALETTES[h % PALETTES.length];
  const haloVariant = (h >>> 3) % 4;
  const hairVariant = (h >>> 6) % 4;
  const jewelVariant = (h >>> 9) % 4;
  const flip = (h >>> 12) % 2 === 1;

  // The bust is drawn first so long hair and the headdress can sit behind and above the face.
  const body = `
    <path d="M9 64 C9 50.5 19 46 32 46 C45 46 55 50.5 55 64 Z" fill="${c.figure}"/>
    <rect x="28.4" y="37" width="7.2" height="11" rx="2" fill="${c.figure}"/>`;
  const face = `<ellipse cx="32" cy="30.5" rx="9.2" ry="11.2" fill="${c.figure}"/>`;
  const hairBehind = hairVariant === 2 ? headdress(2, c) : "";
  const hairAbove = hairVariant === 2 ? "" : headdress(hairVariant, c);
  const eyes = `<path d="M26.4 30.6 q2 -1.6 4 0 M33.6 30.6 q2 -1.6 4 0" stroke="${c.bg}" stroke-width="1.15" fill="none" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<rect width="64" height="64" fill="${c.bg}"/>
<g${flip ? ' transform="translate(64 0) scale(-1 1)"' : ""}>
${halo(haloVariant, c)}
${hairBehind}
${body}
${face}
${eyes}
${hairAbove}
${jewellery(jewelVariant, c)}
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
