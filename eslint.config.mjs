import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // Phase A: keep the recommended presets (TS + Vue + JSON + Markdown).
    // Type-aware rules are NOT enabled to keep the Nuxt auto-import surface
    // simple; code uses explicit imports for clarity.
    vue: true,
    typescript: true,
  },
  {
    ignores: [
      '**/.nuxt/**',
      '**/.output/**',
      '**/.data/**',
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/pnpm-lock.yaml',
      '**/*.d.ts',
      // Generated from the PPB OpenAPI contract (scripts/gen-types.sh) —
      // linted by openapi-typescript upstream, not by the panel.
      '**/types/generated.ts',
      // Standalone Node tooling (contract-consistency checker, type regen) —
      // not part of the app lint surface (same convention as PPF).
      '**/scripts/**',
    ],
  },
  {
    // The pnpm/yaml-enforce-settings rule forces `trustPolicy: no-downgrade`,
    // which breaks `pnpm install`/script execution against the configured
    // registry for two transitive packages (see pnpm-workspace.yaml + plan).
    // Disabled for Phase A; re-enable once the lockfile is trusted.
    files: ['**/pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
    },
  },
)
