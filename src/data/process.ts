export interface Phase {
  n: string;
  title: string;
  weeks: string;
  summary: string;
  deliverables: string[];
}

export const PHASES: Phase[] = [
  {
    n: "01",
    title: "Discovery & Brief",
    weeks: "Week 1",
    summary:
      "We define scope before anything else. An intake form covers your business goals, audience, and requirements, producing a living document that pins down exactly what we're building.",
    deliverables: ["Completed project brief", "Sitemap", "Functional tools scope", "Timeline"],
  },
  {
    n: "02",
    title: "Design",
    weeks: "Weeks 2-3",
    summary:
      "Wireframes and visual design come before any code. You review and approve each layer separately. Nothing moves to build until design is signed off.",
    deliverables: ["Wireframes", "Desktop & mobile mockups", "Typography & color spec", "Component library preview"],
  },
  {
    n: "03",
    title: "Development",
    weeks: "Weeks 3-6",
    summary:
      "Pages are built in priority order with staged releases. You get early access to a staging environment so you can watch it come together. The CMS is integrated and tested here.",
    deliverables: ["Staged page builds", "Staging environment access", "CMS integration", "Functional tools wired up"],
  },
  {
    n: "04",
    title: "QA & Launch",
    weeks: "Weeks 6-8",
    summary:
      "A final pass covers responsiveness, accessibility, SEO, and every interactive feature. After your approval, the site deploys to production. No vague timelines. No black-box delivery.",
    deliverables: ["Responsive & accessibility QA", "SEO & performance checks", "Production deploy + DNS handover", "Documentation"],
  },
];
