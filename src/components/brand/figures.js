/**
 * Indian deity sculptures used across the identity. All are male figures in the Cleveland Museum of Art's Open Access
 * programme (CC0). Images are cut out from the museum photographs and converted to greyscale.
 * Keep this list in sync with the credits in Footer.jsx and README.md.
 */
export const FIGURES = {
  "shiva-mahadeva": {
    title: "Standing Shiva Mahadeva", accession: "1989.369", place: "Northern India, Kashmir, 8th century", cmaId: 154793,
    sources: [["/brand/shiva-mahadeva-sm.webp", 332], ["/brand/shiva-mahadeva-lg.webp", 603]], width: 603, height: 1106,
  },
  "shiva-music": {
    title: "Shiva as Lord of Music", accession: "1971.117", place: "South India, Tamil Nadu, Chola period, c. 1000", cmaId: 145695,
    sources: [["/brand/shiva-music-sm.webp", 335], ["/brand/shiva-music-lg.webp", 609]], width: 609, height: 1113,
  },
  "surya": {
    title: "Surya, the Sun God", accession: "1965.557", place: "India, Kashmir, early 700s", cmaId: 142033,
    sources: [["/brand/surya-sm.webp", 223], ["/brand/surya-lg.webp", 405]], width: 405, height: 1327,
  },
  "hanuman": {
    title: "Monkey General Hanuman", accession: "1980.26", place: "Southern India, Chola period, c. 1000", cmaId: 150048,
    sources: [["/brand/hanuman-sm.webp", 241], ["/brand/hanuman-lg.webp", 439]], width: 439, height: 1118,
  },
  "ganesha": {
    title: "Ganesha", accession: "1970.62", place: "South India, Chola dynasty, c. 1070", cmaId: 145407,
    sources: [["/brand/ganesha-sm.webp", 329], ["/brand/ganesha-lg.webp", 599]], width: 599, height: 1142,
  },
  "nataraja": {
    title: "Nataraja, Shiva as the Lord of Dance", accession: "1930.331", place: "South India, Tamil Nadu, Chola period, 1000s", cmaId: 111811,
    sources: [["/brand/nataraja-sm.webp", 553], ["/brand/nataraja-lg.webp", 1006]], width: 1006, height: 1149,
  },
  "vishnu": {
    title: "Vishnu", accession: "1963.104.2", place: "South India, Tamil Nadu, early Chola, 900–950", cmaId: 138692,
    sources: [["/brand/vishnu-sm.webp", 256], ["/brand/vishnu-lg.webp", 465]], width: 465, height: 1315,
  },
};

export const FIGURE_IDS = Object.keys(FIGURES);

/** Stable pick so the same place always shows the same figure, different places differ. */
export function figureFor(key, choices = FIGURE_IDS) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return choices[h % choices.length];
}
