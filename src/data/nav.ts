// Small bits of navigation/marketing data shared across the shell.

export const EXPLORE_LINKS: { label: string; href: string }[] = [
  { label: "Process", href: "/process" },
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

// Tech the studio builds with — shown in the homepage marquee.
export const TECH_STACK: string[] = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Vercel",
  "Resend",
  "Structured Data",
  "AIO",
  "Core Web Vitals",
  "Accessibility",
];

// Why technical teams choose Deneb4 — used on the homepage credentials strip.
export const CREDENTIALS: { stat: string; desc: string }[] = [
  { stat: "You own it",      desc: "Full source code & data, in your name" },
  { stat: "Fixed price",     desc: "Scoped and quoted before work begins" },
  { stat: "2–6 wks",         desc: "Typical delivery, by package" },
  { stat: "1:1",             desc: "Direct to the builder, no account managers" },
  { stat: "AIO-ready",       desc: "Structured for ChatGPT, Gemini & search" },
  { stat: "Next.js",         desc: "Modern, well-supported foundation" },
];
