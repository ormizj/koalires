import withNuxt from './.nuxt/eslint.config.mjs';
import eslintJs from '@eslint/js';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

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
  eslintPluginPrettier // Enforces Prettier formatting as ESLint errors
);
