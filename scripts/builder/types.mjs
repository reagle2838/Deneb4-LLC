/**
 * Shared JSDoc typedefs for the Builder engine. No runtime exports; these
 * document the shapes the deterministic engine passes around. Config safety
 * is enforced at runtime by validateBuildConfig (config.mjs), which is the
 * guarantee that matters since configs will eventually come from an external
 * form/compiler, not from TypeScript.
 *
 * @typedef {Object} BuildConfig
 * @property {1} schemaVersion
 * @property {string} client           Client slug. The runner confirms it exists + is at `building`.
 * @property {string} siteName         Display name, drives <title>/brand.
 * @property {{ id: string, version?: string }} template
 * @property {Record<string, boolean>} modules   Which modules are on, e.g. { hero:true, services:false }.
 * @property {{ preset: string, accent?: string, layout?: string }} theme
 * @property {Record<string, string>} copy       Fact-slot id -> the client-SUPPLIED fact value.
 *
 * @typedef {'required'|'optional'} SlotRequirement
 *
 * @typedef {Object} ModuleSpec
 * @property {boolean} required        Module must be enabled (e.g. hero).
 * @property {string} section          Partial name for the section body.
 * @property {string|null} route       Dedicated route, or null (index-only section).
 * @property {string} [navLabel]       Nav link text (route modules).
 * @property {Record<string, SlotRequirement>} slots
 *
 * @typedef {Object} TemplateDescriptor
 * @property {string} id
 * @property {string} version
 * @property {'static'} kind
 * @property {Record<string, ModuleSpec>} modules
 * @property {Record<string, Record<string, string>>} presets   preset -> CSS var map.
 * @property {string[]} layouts
 * @property {string[]} baseRoutes
 * @property {string[]} assets
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 *
 * @typedef {Object} AssembleResult
 * @property {string} slug
 * @property {string} outDir
 * @property {{ public: string[], gated: string[], assets: string[] }} routes
 * @property {string[]} enabledModules
 * @property {string} preset
 * @property {string} [accent]
 * @property {string} summary          Human-readable change summary.
 * @property {string[]} changedFiles   Files whose content changed vs the previous build.
 */

export {};
