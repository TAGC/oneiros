/** The Astrolabe's browser code: everything its page script, `start.ts`, imports at run time. */
const CLIENT_START = '^src/astrolabe/start\\.ts$';

/**
 * Modules that render localised text themselves and so read `src/i18n/ui.ts` directly. Keep
 * this list from growing: pass a new module the strings it needs (`UI` or a few of its
 * values) instead.
 */
const RENDERS_TEXT = [
  // Renders question markers and infobox rows into a page's HTML.
  '^src/lib/remark-wiki\\.ts$',
  // Link labels, status names and the listed non-page conflict sources.
  '^src/lib/wiki\\.ts$',
  // A cluster's name falls back to the area's Chinese name.
  '^src/lib/questions/clusters\\.ts$',
  // Names the listed non-page conflict sources in a failure.
  '^src/lib/questions/problems\\.ts$',
  // Lays out labels whose width depends on the localised text.
  '^src/astrolabe/sky\\.ts$',
  '^src/astrolabe/brass\\.ts$',
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular import: move what both modules need into a module of its own.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Import cannot be resolved. If it is a package, add it to package.json.',
      from: {},
      to: { couldNotResolve: true, pathNot: '^astro:' },
    },
    {
      name: 'only-github-module-runs-gh',
      severity: 'error',
      comment:
        'Only scripts/github.ts reaches GitHub (docs/layout.md). src/lib/pages.ts runs `git log` for edit dates.',
      from: { pathNot: ['^scripts/github\\.ts$', '^src/lib/pages\\.ts$'] },
      to: { dependencyTypes: ['core'], path: '^(node:)?child_process$' },
    },
    {
      name: 'domain-not-to-ui-strings',
      severity: 'error',
      comment:
        'Domain modules take the strings they need as arguments; only pages, components and the listed renderers read src/i18n/ui.ts.',
      from: {
        path: ['^src/lib/', '^src/astrolabe/[^/]+\\.ts$'],
        pathNot: [...RENDERS_TEXT, '\\.test\\.ts$'],
      },
      to: { path: '^src/i18n/ui\\.ts$' },
    },
    {
      name: 'astrolabe-client-not-to-build-time',
      severity: 'error',
      comment:
        'The Astrolabe browser code must not reach build-time modules: the questions module, interface strings or Node built-ins.',
      from: { path: CLIENT_START },
      to: {
        reachable: true,
        path: ['^src/lib/questions/', '^src/i18n/ui\\.ts$', '^(node:)?[a-z_]+$'],
      },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['^node_modules/', '^\\.astro/', '^dist/'] },
    // Type-only imports are erased before anything runs, so the rules see run-time imports only.
    tsPreCompilationDeps: false,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
