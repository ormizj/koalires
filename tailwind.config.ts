import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './client/app/**/*.{vue,ts}',
    './client/pages/**/*.{vue,ts}',
    './client/widgets/**/*.{vue,ts}',
    './client/features/**/*.{vue,ts}',
    './client/entities/**/*.{vue,ts}',
    './client/shared/**/*.{vue,ts}',
    './client/plugins/**/*.{vue,ts}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
          elevated: 'var(--color-surface-elevated)',
        },
        content: {
          DEFAULT: 'var(--color-content)',
          secondary: 'var(--color-content-secondary)',
          muted: 'var(--color-content-muted)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          focus: 'var(--color-border-focus)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
          border: 'var(--color-danger-border)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
