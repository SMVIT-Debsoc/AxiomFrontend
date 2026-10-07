/**
 * Indian goddess sculptures used across the identity. All are in the Cleveland Museum of Art's Open Access
 * programme (CC0). Images are cut out from the museum photographs and converted to greyscale.
 * Keep this list in sync with the credits in Footer.jsx and README.md.
 */
export const FIGURES = {
  "mother-goddess": {
    title: "Mother Goddess", accession: "1970.12", place: "Northwestern India, Rajasthan, Udaipur District, c. 600", cmaId: 144908,
    sources: [["/brand/mother-goddess-480.webp", 480], ["/brand/mother-goddess-960.webp", 960]], width: 960, height: 2673,
  },
  "vidyadevi": {
    title: "Vidyadevi (Goddess of Learning)", accession: "1972.152", place: "India, Western Rajasthan, 10th–11th century", cmaId: 146703,
    sources: [["/brand/vidyadevi-sm.webp", 329], ["/brand/vidyadevi-lg.webp", 640]], width: 640, height: 1400,
  },
  "yakshi": {
    title: "Nature Divinity (Yakshi)", accession: "1968.104", place: "India, Mathura, c. 75 CE", cmaId: 143649,
    sources: [["/brand/yakshi-sm.webp", 270], ["/brand/yakshi-lg.webp", 526]], width: 526, height: 1400,
  },
  "ganga": {
    title: "River Goddess Ganga", accession: "1966.119", place: "Northern India, Uttar Pradesh, Mathura, c. 700", cmaId: 142284,
    sources: [["/brand/ganga-sm.webp", 341], ["/brand/ganga-lg.webp", 663]], width: 663, height: 1400,
  },
  "lotus-goddess": {
    title: "Goddess Holding a Lotus", accession: "1984.2", place: "South India, Tamil Nadu, Chola period, c. 950", cmaId: 151924,
    sources: [["/brand/lotus-goddess-sm.webp", 236], ["/brand/lotus-goddess-lg.webp", 459]], width: 459, height: 1400,
  },
  "durga": {
    title: "Durga Destroying the Buffalo Demon", accession: "1982.45", place: "Northern India, Kashmir or Himachal Pradesh, 9th–10th century", cmaId: 150996,
    sources: [["/brand/durga-sm.webp", 459], ["/brand/durga-lg.webp", 892]], width: 892, height: 1400,
  },
  "siddhalakshmi": {
    title: "Goddess Siddhalakshmi", accession: "1982.47", place: "India, Kashmir, 1000s", cmaId: 150998,
    sources: [["/brand/siddhalakshmi-sm.webp", 352], ["/brand/siddhalakshmi-lg.webp", 685]], width: 685, height: 1400,
  },
};

export const FIGURE_IDS = Object.keys(FIGURES);

/** Stable pick so the same place always shows the same figure, different places differ. */
export function figureFor(key, choices = FIGURE_IDS) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return choices[h % choices.length];
}
