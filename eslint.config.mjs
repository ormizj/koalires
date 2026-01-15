import withNuxt from './.nuxt/eslint.config.mjs'
import eslintJs from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'

export default withNuxt(
  eslintJs.configs.recommended,
  {
    rules: {
      // Disable base rules that conflict with TypeScript
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off', // Use @typescript-eslint/no-unused-vars instead
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },
  eslintConfigPrettier,
)
