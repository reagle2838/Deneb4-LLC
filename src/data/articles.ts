import type { Article } from "@/types";

// Seeded articles. When a CMS is added later, this array is the shape the
// editor should produce. Bodies are HTML rendered inside `.article-body`.
export const ARTICLES: Article[] = [
  {
    slug: "why-industrial-buyers-judge-your-site-in-seconds",
    title: "Why Industrial Buyers Judge Your Website in Seconds",
    subtitle: "Engineers and procurement managers evaluate credibility differently than retail customers. Here's what actually moves them.",
    type: "Article",
    topic: "Strategy",
    date: "2026-05-28",
    readTime: "6 min read",
    body: `
      <p>When an engineer, a procurement manager, or an operations lead lands on your site, they are not looking to be charmed. They are looking for evidence. Can you do the thing they need? Have you done it before, at their scale, under their constraints? Can they trust you with a six-figure purchase order?</p>
      <h2>Credibility is technical, not decorative</h2>
      <p>A polished brochure with stock photos of handshakes does not work on this audience. What works is specificity: tolerances, capacities, certifications, materials, lead times, and named examples of real work. Generic marketing fluff signals that you don't actually understand the buyer's world.</p>
      <ul>
        <li>State capabilities in the buyer's units: CFM, lbs, UL ratings, microns, voltage.</li>
        <li>Show finished work, not concept art.</li>
        <li>Make specs and certifications easy to find, not buried in a PDF.</li>
      </ul>
      <h2>Clarity beats cleverness</h2>
      <p>Technical buyers reward sites that respect their time. Clear navigation, fast pages, and an unambiguous path to a quote outperform animation and marketing language every time. Your site should answer the buyer's first three questions before they have to ask.</p>
      <p>The goal isn't a prettier brochure. It's infrastructure that does a job: qualifying buyers and generating the right inquiries while you're on the floor.</p>
    `,
  },
  {
    slug: "aio-getting-cited-by-chatgpt-and-gemini",
    title: "AIO: Getting Your Technical Site Cited by ChatGPT and Gemini",
    subtitle: "Search is no longer the only front door. AI Optimization structures your content so assistants can find, trust, and quote it.",
    type: "Article",
    topic: "AI & Discoverability",
    date: "2026-05-12",
    readTime: "7 min read",
    body: `
      <p>More of your buyers are starting their research inside an AI assistant. They ask ChatGPT or Gemini to compare options, summarize capabilities, or recommend a supplier. If your site isn't structured for that, you simply don't appear in the answer.</p>
      <h2>What AIO actually means</h2>
      <p>AI Optimization (AIO) is the practice of structuring content so large language models can parse it accurately and cite it confidently. It overlaps with good SEO, but the emphasis shifts toward <strong>machine-readable clarity</strong>.</p>
      <ul>
        <li>Explicit, well-structured answers to real buyer questions (a strong FAQ is gold).</li>
        <li>Clean semantic HTML and structured data the model can map to entities.</li>
        <li>Specifications stated as plain, extractable text: not locked inside images or PDFs.</li>
        <li>Consistent naming of products, capabilities, and the problems you solve.</li>
      </ul>
      <h2>Why technical businesses win here</h2>
      <p>Industrial buyers ask precise questions, and precise, well-organized content is exactly what assistants reward. If you've already done the work of being clear for humans, AIO is the small extra step that gets you in front of the AI, too.</p>
    `,
  },
  {
    slug: "own-your-code-vs-renting-a-website-builder",
    title: "Own Your Code vs. Renting a Website Builder",
    subtitle: "A website built on a proprietary platform is a rental. Treating it as owned infrastructure changes the math.",
    type: "Article",
    topic: "Ownership & Infrastructure",
    date: "2026-04-22",
    readTime: "5 min read",
    body: `
      <p>Most website platforms are rentals. You pay monthly, you build inside their walls, and the day you stop paying, the asset evaporates. For a business that plans in decades, that's a strange way to treat something this important.</p>
      <h2>The rental trap</h2>
      <p>Proprietary builders lock your content, your structure, and often your data inside a system you don't control. Migrating off later is expensive precisely because it was designed to be.</p>
      <h2>Infrastructure you own</h2>
      <p>The alternative is to treat your website like the rest of your capital equipment: something you own outright.</p>
      <ul>
        <li>You hold the full source code and all associated data.</li>
        <li>Your hosting, domain, and analytics accounts stay in your name.</li>
        <li>No mandatory monthly retainer to keep the lights on.</li>
        <li>Any competent developer can maintain or extend it: you're not hostage to one vendor.</li>
      </ul>
      <p>Built on modern, well-supported tools, an owned site keeps working and keeps its value long after a rented one would have become a recurring line item.</p>
    `,
  },
  {
    slug: "what-to-define-before-a-website-project",
    title: "What to Define Before You Start a Website Project",
    subtitle: "The fastest builds start with the clearest briefs. Here's what to nail down before design begins.",
    type: "Article",
    topic: "Process",
    date: "2026-04-03",
    readTime: "5 min read",
    body: `
      <p>The difference between a four-week project and a four-month one is rarely the build. It's the brief. The more clearly the scope is defined up front, the faster and cheaper everything downstream becomes.</p>
      <h2>Define these first</h2>
      <ul>
        <li><strong>The buyer.</strong> Who are you trying to reach, and what do they need to see to trust you?</li>
        <li><strong>The job.</strong> What should the site <em>do</em>: generate quotes, present a catalog, support hiring?</li>
        <li><strong>The proof.</strong> Which projects, specs, and credentials make the case for you?</li>
        <li><strong>The scope.</strong> How many pages, and which functional tools (catalog, quote form, careers)?</li>
      </ul>
      <h2>Why design waits for sign-off</h2>
      <p>Nothing should move to build until the design is signed off. Wireframes and visual design are cheap to change; built pages are not. Locking each layer before the next begins is what keeps a fixed-scope, fixed-price project actually fixed.</p>
    `,
  },
  {
    slug: "eagle-engineering-55-year-firm-rebuilt",
    title: "Case Study: A 55-Year-Old Industrial Firm, Rebuilt as Infrastructure",
    subtitle: "How a multi-division engineering and distribution company got a site that finally matched its depth.",
    type: "Case Study",
    topic: "Case Study",
    date: "2026-03-15",
    readTime: "8 min read",
    body: `
      <p>Eagle Engineering & Supply Co. has been engineering industrial systems since 1969: electrical control design, proprietary material handling equipment, authorized power distribution, and industrial technology. The depth was real. The website wasn't carrying it.</p>
      <h2>The challenge</h2>
      <p>Five decades of capability spread across four distinct divisions, plus trademarked proprietary equipment and authorized distribution lines: none of it legible to a first-time buyer. The site had to serve specifiers, procurement, and plant managers across very different sectors without becoming a maze.</p>
      <h2>The approach</h2>
      <ul>
        <li>A full-screen mega menu that lets buyers self-select by service, by industry, or by reading the technical insights.</li>
        <li>A blueprint-grade visual system with monospace spec tags, technical cards, and light/dark theming that reads as engineering, not marketing.</li>
        <li>Division and product pages structured around specs, applications, and credible proof.</li>
        <li>A quote path on every page, plus a careers system with resume upload.</li>
      </ul>
      <h2>The result</h2>
      <p>A site that works as hard as the company does: clear to a technical buyer in seconds, owned outright by the client, and built to extend as the business grows. The same design language and navigation you're looking at right now started there.</p>
    `,
  },
];

// Articles grouped by topic — drives the Articles mega panel.
export const ARTICLE_TOPICS: string[] = Array.from(
  new Set(ARTICLES.map((a) => a.topic))
);

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesByDate(): Article[] {
  return [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
}
