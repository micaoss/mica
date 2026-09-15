import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    react: true,
    typescript: true,
    ignores: [
      'design/**',
      'dist/**',
      'coverage/**',
      '.astro/**',
      // A checkout of micaoss/mica, and the copies prepare-docs generates from it.
      '.mica-docs/**',
      'src/content/docs/**',
    ],
  },
  {
    // Registry output is owned code, but its house style is the registry's, not
    // ours: it exports variant helpers beside components and uses the pre-React-19
    // context idioms. Diverging would only make the next `shadcn add` conflict.
    files: ['src/shared/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react/no-use-context': 'off',
      'react/no-context-provider': 'off',
    },
  },
)
