import fs from 'node:fs';
import path from 'node:path';
import { resolveDeterministicCopy, refineCopy } from './copy.mjs';

/**
 * The deterministic assembly transform: a validated config + a template ->
 * files in outDir. Config-level only (toggle modules, apply theme, inject
 * supplied facts). No structure is ever invented; a leftover placeholder is a
 * hard error so nothing half-templated ships.
 *
 * Token grammar handled by renderTemplate:
 *   {{siteName}}                      -> config.siteName
 *   {{slot.NAME}}                     -> resolved copy slot value
 *   {{?slot.NAME}}...{{/NAME}}        -> conditional: kept iff slot NAME is non-empty
 *   {{partial:NAME}}                  -> templates/<id>/partials/NAME.html (recursive)
 *   {{sections}}                      -> enabled modules' section partials, in order
 *   {{nav}}                           -> nav links for enabled modules with routes
 */

function readPartial(templateDir, name) {
  const file = path.join(templateDir, 'partials', `${name}.html`);
  if (!fs.existsSync(file)) throw new Error(`Missing partial "${name}" (${file}).`);
  return fs.readFileSync(file, 'utf-8');
}

function renderTemplate(source, ctx) {
  let out = source;

  // 1. Expand structure tokens (partials/sections/nav) until stable.
  for (let i = 0; i < 20; i++) {
    let changed = false;
    out = out.replace(/\{\{sections\}\}/g, () => {
      changed = true;
      return ctx.sectionSources.join('\n');
    });
    out = out.replace(/\{\{nav\}\}/g, () => {
      changed = true;
      return ctx.navHtml;
    });
    out = out.replace(/\{\{partial:([a-zA-Z0-9_-]+)\}\}/g, (_m, name) => {
      changed = true;
      return readPartial(ctx.templateDir, name);
    });
    if (!changed) break;
  }

  // 2. Conditional slot blocks: keep inner iff the slot has a non-empty value.
  out = out.replace(/\{\{\?slot\.([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, name, inner) =>
    ctx.slots[name] ? inner : ''
  );

  // 3. Value substitution.
  out = out.replace(/\{\{slot\.([a-zA-Z0-9_]+)\}\}/g, (_m, name) => ctx.slots[name] ?? '');
  out = out.replace(/\{\{siteName\}\}/g, ctx.siteName);

  return out;
}

/**
 * @param {import('./types.mjs').BuildConfig} cfg
 * @param {{ id: string, dir: string, descriptor: import('./types.mjs').TemplateDescriptor }} template
 * @param {string} outDir
 */
export async function assemble(cfg, template, outDir) {
  const { descriptor, dir: templateDir } = template;
  const enabledModules = Object.keys(descriptor.modules).filter((k) => cfg.modules[k] === true);

  // Copy resolution + optional LLM refinement (structure decided before this).
  let slots = resolveDeterministicCopy(cfg, descriptor);
  slots = await refineCopy(slots, cfg.copy, { apiKey: process.env.ANTHROPIC_API_KEY });

  // Theme: preset overlaid with an optional accent override.
  const presetVars = { ...descriptor.presets[cfg.theme.preset] };
  if (cfg.theme.accent) presetVars['--accent'] = cfg.theme.accent;
  const themeCss =
    ':root {\n' +
    Object.entries(presetVars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n') +
    '\n}\n';

  // Nav: only enabled modules that have a route (so the crawl never finds a
  // link to a route that was not emitted).
  const navHtml = enabledModules
    .map((k) => descriptor.modules[k])
    .filter((m) => m.route)
    .map((m) => `<a href="${m.route}">${m.navLabel || m.route}</a>`)
    .join('\n    ');

  // Section sources for the index page, in descriptor order.
  const sectionSources = enabledModules.map((k) => readPartial(templateDir, descriptor.modules[k].section));

  const ctx = { templateDir, slots, siteName: cfg.siteName, navHtml, sectionSources };

  // Write assets + generated theme.
  fs.mkdirSync(outDir, { recursive: true });
  for (const asset of fs.readdirSync(path.join(templateDir, 'assets'))) {
    fs.copyFileSync(path.join(templateDir, 'assets', asset), path.join(outDir, asset));
  }
  fs.writeFileSync(path.join(outDir, 'theme.css'), themeCss);

  // Emit pages: index always; plus each enabled module's route page.
  const pages = [{ file: 'index.html.tmpl', out: 'index.html', route: '/' }];
  const publicRoutes = ['/'];
  for (const k of enabledModules) {
    const m = descriptor.modules[k];
    if (!m.route) continue;
    const seg = m.route.replace(/^\//, '');
    pages.push({ file: `${seg}.html.tmpl`, out: `${seg}.html`, route: m.route });
    publicRoutes.push(m.route);
  }

  for (const p of pages) {
    const src = fs.readFileSync(path.join(templateDir, 'pages', p.file), 'utf-8');
    const rendered = renderTemplate(src, ctx);
    const leftover = rendered.match(/\{\{[^}]*\}\}/);
    if (leftover) throw new Error(`Unresolved placeholder "${leftover[0]}" in ${p.out}. Refusing to ship half-templated output.`);
    fs.writeFileSync(path.join(outDir, p.out), rendered);
  }

  return {
    enabledModules,
    preset: cfg.theme.preset,
    accent: cfg.theme.accent,
    routes: { public: publicRoutes, gated: [], assets: descriptor.assets },
    resolvedConfig: { siteName: cfg.siteName, modules: cfg.modules, theme: cfg.theme },
  };
}
