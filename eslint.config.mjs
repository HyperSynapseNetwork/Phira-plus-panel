import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // Recommended TypeScript + Vue + JSON + Markdown presets.
    // Type-aware rules stay disabled because Nuxt auto-imports are validated
    // separately by vue-tsc/typecheck.
    vue: true,
    typescript: true,
  },
  {
    rules: {
      'vue/no-template-shadow': 'error',
      'no-shadow': 'error',
    },
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
    // Keep disabled while the current lockfile/registry combination requires it.
    files: ['**/pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
    },
  },
)
