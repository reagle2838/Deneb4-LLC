# Deneb4 Website

Marketing site for **Deneb4** — web design & development for industrial, engineering, and manufacturing
businesses.

Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS 3.4**. The design
language (blueprint grid, monospace "spec" labels, card system, full-screen mega menu, light/dark theming)
mirrors the Eagle Engineering site, reskinned to Deneb4's teal brand palette.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build + type/lint check
npm start          # serve the production build
```

## Forms & email

The Contact (`/contact`) and Start-a-Project (`/start`) forms POST to Next.js API routes
(`/api/contact`, `/api/project`) which send email via [Resend](https://resend.com).

1. Copy `.env.example` → `.env.local`.
2. Add your `RESEND_API_KEY` and verify a sending domain in Resend.
3. Set `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL`.

Without a key, submissions are logged to the server console and still return success — so everything works
locally before email is wired up.

## Content

Most editable content lives in `src/data/`:

- `services.ts` — packages, pricing, functional tools, add-ons
- `industries.ts` — industries served (drives the Industries mega panel)
- `articles.ts` — blog/insights posts (drives `/articles` and the Articles mega panel)
- `nav.ts` — navigation structure

Brand colors are CSS variables in `src/app/globals.css` (`--accent`, backgrounds, text) — change them in
one place to retheme the whole site.

## Project structure

```
src/
  app/          routes (App Router) + globals.css + layout
  components/   layout/ (Navbar mega menu, Footer, SiteShell) + ui/
  context/      ThemeContext (light/dark)
  data/         editable content
  lib/          email helper
  types/        shared types
```

## To add later

A real Deneb4 logo (drop into `/public`, swap the wordmark in `Navbar`/`Footer`), an admin/CMS backend
for articles, and analytics.
