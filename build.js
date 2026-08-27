#!/usr/bin/env node
/**
 * AlltiVent Duct — statisk sidgenerator.
 *
 * Läser content/site.json + src/template.html + src/styles.css och skriver
 * en färdig, självförsörjande sida till dist/. Inga beroenden.
 *
 *   node build.js            bygg till dist/
 *   node build.js --check    bygg till en temporär katalog och validera bara
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const CHECK_ONLY = process.argv.includes('--check');
const OUT = CHECK_ONLY
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'alltivent-check-'))
  : path.join(ROOT, 'dist');

const warnings = [];
const errors = [];

/* ---------- hjälpfunktioner ---------- */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Tillåter enkel märkning i innehållsfilen: {mono:...} och {b:...}
const rich = (s) =>
  esc(s)
    .replace(/\{mono:([^}]*)\}/g, '<span class="mono">$1</span>')
    .replace(/\{b:([^}]*)\}/g, '<strong>$1</strong>');

const get = (obj, dotted) =>
  dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const ICONS = {
  document:
    '<path d="M4 4h11l5 5v11H4z"/><path d="M8 13l2.5 2.5L16 10"/>',
  leaf:
    '<path d="M12 21c-5-3-8-6.5-8-11a8 8 0 0116 0c0 4.5-3 8-8 11z"/><path d="M12 3v18"/>',
  recycle:
    '<path d="M3 12a9 9 0 0114-7.5M21 12a9 9 0 01-14 7.5"/><path d="M17 3v4h-4M7 21v-4h4"/>',
  pallet:
    '<rect x="3" y="7" width="18" height="12" rx="1"/><path d="M3 11h18M8 7V4h8v3"/>',
};

const icon = (name) => {
  const body = ICONS[name];
  if (!body) {
    errors.push(`Okänd ikon "${name}" i content/site.json (finns: ${Object.keys(ICONS).join(', ')})`);
    return '';
  }
  return `<svg width="20" height="20" viewBox="0 0 24 24" stroke="#00C2CC" stroke-width="2" fill="none">${body}</svg>`;
};

/* ---------- läs in ---------- */

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const template = fs.readFileSync(path.join(ROOT, 'src/template.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');

/* ---------- validera innehållet ---------- */

const REQUIRED = [
  'meta.title', 'meta.description', 'meta.siteUrl',
  'company.legalName', 'company.orgNr', 'company.street', 'company.postalCode', 'company.city',
  'emails.offert', 'emails.order', 'emails.info',
  'hero.headingLines', 'products.items', 'tech.specs', 'services.items', 'contact.cards',
];
for (const key of REQUIRED) {
  const v = get(data, key);
  if (v == null || (Array.isArray(v) && v.length === 0) || v === '') {
    errors.push(`Obligatoriskt fält saknas eller är tomt: ${key}`);
  }
}

const mailOf = (key) => {
  const addr = data.emails[key];
  if (!addr) errors.push(`Okänd e-postnyckel "${key}" — lägg till den under "emails" i content/site.json`);
  return addr || '';
};

for (const [key, addr] of Object.entries(data.emails)) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) errors.push(`Ogiltig e-postadress för "${key}": ${addr}`);
}

const codes = new Set();
for (const item of data.products.items) {
  if (codes.has(item.code)) errors.push(`Dubblerad artikelkod i produktprogrammet: ${item.code}`);
  codes.add(item.code);
  if (!item.name || !item.description) errors.push(`Produkt ${item.code} saknar namn eller beskrivning`);
}

if (data.meta.title.length > 65) warnings.push(`meta.title är ${data.meta.title.length} tecken — Google klipper oftast vid ~60.`);
if (data.meta.description.length > 165) warnings.push(`meta.description är ${data.meta.description.length} tecken — sikta på 150–160.`);

/* ---------- bygg blocken ---------- */

const [firstWord, ...restWords] = data.company.name.split(' ');
data.company.name = { full: data.company.name, first: firstWord, rest: restWords.join(' ') };
data.ctaBand.button.address = mailOf(data.ctaBand.button.email);

const blocks = {};

blocks.styles = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\n{2,}/g, '\n')
  .trim();

blocks.socialMeta = [
  ['og:type', 'website'],
  ['og:site_name', data.company.legalName],
  ['og:title', data.meta.title],
  ['og:description', data.meta.description],
  ['og:url', `${data.meta.siteUrl}/`],
  ['og:locale', 'sv_SE'],
]
  .map(([p, c]) => `<meta property="${p}" content="${esc(c)}">`)
  .concat([`<meta name="twitter:card" content="summary_large_image">`])
  .concat(
    data.meta.ogImage && fs.existsSync(path.join(ROOT, 'public', path.basename(data.meta.ogImage)))
      ? [`<meta property="og:image" content="${esc(data.meta.siteUrl + data.meta.ogImage)}">`]
      : []
  )
  .join('\n');

blocks.topbarLinks = data.topbar.links
  .map((l) => `${esc(l.label)}: <a href="mailto:${mailOf(l.email)}">${esc(mailOf(l.email))}</a>`)
  .join(' &nbsp;·&nbsp; ');

blocks.nav = data.nav
  .map((n) => `        <li><a${n.cta ? ' class="nav-cta"' : ''} href="${esc(n.href)}">${esc(n.label)}</a></li>`)
  .join('\n');

blocks.heroHeading = data.hero.headingLines
  .map((line, i) => (i === data.hero.accentLine ? `<em>${esc(line)}</em>` : esc(line)))
  .join('<br>');

blocks.heroCtas = data.hero.ctas
  .map((c) => `        <a class="btn btn-${c.style === 'primary' ? 'primary' : 'ghost'}" href="${esc(c.href)}">${esc(c.label)}</a>`)
  .join('\n');

blocks.routes = data.routes
  .map(
    (r) => `      <a class="route" href="mailto:${mailOf(r.email)}">
        <h4>${esc(r.title)}</h4>
        <p>${esc(r.text)}</p>
        <span class="mono">${esc(mailOf(r.email))}</span>
      </a>`
  )
  .join('\n');

blocks.productColumns = data.products.columns.map((c) => `<th>${esc(c)}</th>`).join('');

blocks.productRows = data.products.items
  .map(
    (p) =>
      `        <tr><td><span class="code">${esc(p.code)}</span></td><td>${esc(p.name)}</td><td>${esc(p.description)}</td></tr>`
  )
  .join('\n');

blocks.accessories = data.products.accessories
  .map((a) => `      <span class="chip">${esc(a)}</span>`)
  .join('\n');

blocks.specRows = data.tech.specs
  .map((s) => `        <tr><td>${esc(s.name)}</td><td>${rich(s.value)}</td></tr>`)
  .join('\n');

blocks.services = data.services.items
  .map(
    (s) => `      <div class="serv">
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.text)}</p>
      </div>`
  )
  .join('\n');

blocks.why = data.why.items
  .map(
    (w) => `      <div class="why">
        <span class="mono">${esc(w.tag)}</span>
        <h3>${esc(w.title)}</h3>
        <p>${esc(w.text)}</p>
      </div>`
  )
  .join('\n');

blocks.envPoints = data.env.points
  .map(
    (p) => `        <li>
          ${icon(p.icon)}
          <span><strong>${esc(p.title)}</strong> — ${esc(p.text)}</span>
        </li>`
  )
  .join('\n');

blocks.facts = data.about.facts
  .map((f) => `        <li><span class="mono">${esc(f.tag)}</span><span>${rich(f.text)}</span></li>`)
  .join('\n');

const addressHtml = `${esc(data.company.legalName)}<br>${esc(data.company.street)}<br>${esc(
  data.company.postalCode
)} ${esc(data.company.city)}`;

blocks.contactCards = data.contact.cards
  .map((c) => {
    const parts = [`        <h3>${esc(c.title)}</h3>`];
    if (c.address) parts.push(`        <p>${addressHtml}</p>`);
    if (c.text) parts.push(`        <p>${esc(c.text)}</p>`);
    if (c.emails) {
      const links = c.emails
        .map((k) => `<a href="mailto:${mailOf(k)}">${esc(mailOf(k))}</a>`)
        .join('<br>\n           ');
      parts.push(`        <p>${links}</p>`);
    }
    if (c.note)
      parts.push(`        <p class="mono" style="font-size:12px;color:var(--zinc-400)">${esc(c.note)}</p>`);
    return `      <div class="contact-card">\n${parts.join('\n')}\n      </div>`;
  })
  .join('\n');

blocks.footerColumns = data.footer.columns
  .map((col) => {
    const links = col.links
      .map((l) => {
        const href = l.email ? `mailto:${mailOf(l.email)}` : l.href;
        return href
          ? `          <li><a href="${esc(href)}">${esc(l.label)}</a></li>`
          : `          <li>${esc(l.label)}</li>`;
      })
      .join('\n');
    return `      <div>
        <h4>${esc(col.title)}</h4>
        <ul>
${links}
        </ul>
      </div>`;
  })
  .join('\n');

blocks.jsonld = JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'Manufacturer',
    name: data.company.legalName,
    description: data.meta.description,
    url: `${data.meta.siteUrl}/`,
    email: data.emails.info,
    identifier: { '@type': 'PropertyValue', name: 'Organisationsnummer', value: data.company.orgNr },
    parentOrganization: { '@type': 'Organization', name: data.company.parent },
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.company.street,
      postalCode: data.company.postalCode,
      addressLocality: data.company.city,
      addressRegion: data.company.region,
      addressCountry: data.company.country,
    },
    areaServed: data.company.region,
    makesOffer: data.products.items.map((p) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Product', sku: p.code, name: p.name, description: p.description },
    })),
  },
  null,
  2
);

/* ---------- rendera ---------- */

data.blocks = blocks;

let html = template
  .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (m, key) => {
    const v = get(data, key);
    if (v === undefined) { errors.push(`Mallen refererar till okänt fält: {{{${key}}}}`); return ''; }
    return String(v);
  })
  .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const v = get(data, key);
    if (v === undefined) { errors.push(`Mallen refererar till okänt fält: {{${key}}}`); return ''; }
    return esc(v);
  });

/* ---------- validera resultatet ---------- */

const leftover = html.match(/\{\{[^}]*\}\}/g);
if (leftover) errors.push(`Oersatta platshållare i resultatet: ${[...new Set(leftover)].join(', ')}`);

const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const m of html.matchAll(/href="#([^"]+)"/g)) {
  if (!ids.has(m[1])) errors.push(`Ankarlänken #${m[1]} pekar på ett id som inte finns på sidan`);
}

const knownAddresses = new Set(Object.values(data.emails));
for (const m of html.matchAll(/href="mailto:([^"]+)"/g)) {
  if (!knownAddresses.has(m[1])) errors.push(`mailto-länk till okänd adress: ${m[1]}`);
}

for (const m of html.matchAll(/<img\b[^>]*>/g)) {
  if (!/\salt=/.test(m[0])) errors.push(`<img> utan alt-text: ${m[0].slice(0, 60)}`);
}

if (!/<h1[\s>]/.test(html)) errors.push('Sidan saknar <h1>');
if ((html.match(/<h1[\s>]/g) || []).length > 1) warnings.push('Sidan har fler än en <h1>.');

try {
  JSON.parse(blocks.jsonld);
} catch (e) {
  errors.push(`Ogiltig JSON-LD: ${e.message}`);
}

/* ---------- skriv ut ---------- */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${data.meta.siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
);

fs.writeFileSync(
  path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${data.meta.siteUrl}/sitemap.xml\n`
);

const publicDir = path.join(ROOT, 'public');
if (fs.existsSync(publicDir)) fs.cpSync(publicDir, OUT, { recursive: true });

/* ---------- rapport ---------- */

for (const w of warnings) console.warn(`  varning: ${w}`);

if (errors.length) {
  console.error(`\n✗ Bygget stoppades — ${errors.length} fel:\n`);
  for (const e of errors) console.error(`  · ${e}`);
  console.error('');
  process.exit(1);
}

const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
if (CHECK_ONLY) {
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log(`✓ Kontroll OK — ${data.products.items.length} produkter, ${data.tech.specs.length} specrader, ${warnings.length} varningar`);
} else {
  console.log(`✓ Byggd till dist/ — index.html ${kb('index.html')} kB, ${data.products.items.length} produkter, ${warnings.length} varningar`);
}
