export const SITE_ORIGIN = 'https://www.axiom4.online';
export const ORGANISER_URL = 'https://www.smvitdebsoc.com/';

const socialImage = SITE_ORIGIN + '/brand/social-card.png';

export const PUBLIC_PAGES = {
  '/': {
    title: 'AXIOM 4.0 Debate Tournament | SMVIT DebSoc',
    heading: 'AXIOM 4.0 Debate Tournament',
    description: 'AXIOM 4.0 is SMVIT DebSoc’s collegiate debate tournament at Sir MVIT in Bengaluru. Learn about the event and register as a debater.',
  },
  '/about': {
    title: 'About AXIOM 4.0 | Parliamentary Debate at Sir MVIT',
    heading: 'About AXIOM 4.0',
    description: 'Learn about AXIOM 4.0, SMVIT DebSoc’s collegiate parliamentary debate tournament at Sir MVIT in Bengaluru, and how rounds, pairings and results work.',
  },
};

export function pageMetadata(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = Object.hasOwn(PUBLIC_PAGES, path) ? PUBLIC_PAGES[path] : null;
  const tags = [];
  const add = (tag, attrs, children) => tags.push({
    tag, attrs: {...attrs, 'data-page-metadata': ''}, children, injectTo: 'head',
  });

  add('title', {}, page?.title ?? 'AXIOM 4.0 Tournament Workspace');
  if (!page) {
    add('meta', {name: 'robots', content: 'noindex'});
    return tags;
  }

  const url = SITE_ORIGIN + path;
  add('link', {rel: 'canonical', href: url});
  add('meta', {name: 'description', content: page.description});
  for (const [key, value] of Object.entries({
    type: 'website', site_name: 'AXIOM 4.0', url,
    title: page.title, description: page.description, image: socialImage,
    'image:width': '1200', 'image:height': '630', 'image:alt': 'AXIOM 4.0 tournament wordmark',
  })) {
    add('meta', {property: 'og:' + key, content: value});
  }
  for (const [key, value] of Object.entries({
    card: 'summary_large_image', title: page.title, description: page.description,
    image: socialImage, 'image:alt': 'AXIOM 4.0 tournament wordmark',
  })) {
    add('meta', {name: 'twitter:' + key, content: value});
  }
  if (path === '/') {
    add('script', {type: 'application/ld+json'}, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'AXIOM 4.0',
      url,
      publisher: {'@type': 'Organization', name: 'SMVIT DebSoc', url: ORGANISER_URL},
    }));
  }
  return tags;
}
