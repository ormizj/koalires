// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
    '@nuxt/eslint',
    '@pinia/nuxt',
    '~/app/modules/fsd-components',
  ],

  imports: {
    dirs: [
      'shared/lib',
      'shared/api/index.ts',
      'shared/stores/index.ts',
      'shared/config',
      'entities/**/model',
      'entities/**/api',
      'features/**/model',
      'features/**/api',
      'widgets/**/model',
    ],
  },
  devtools: { enabled: true },
  app: {
    head: {
      script: [
        {
          innerHTML: `(function(){var s=localStorage.getItem('theme');var p=window.matchMedia('(prefers-color-scheme:dark)').matches;if(s==='dark'||(!s&&p)){document.documentElement.classList.add('dark')}})();`,
          type: 'text/javascript',
        },
      ],
    },
  },
  css: ['~/app/styles/global.css'],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
  },

  dir: {
    layouts: 'app/layouts',
  },
  srcDir: 'client',

  alias: {
    '@app': '../client/app',
    '@shared': '../client/shared',
    '@entities': '../client/entities',
    '@features': '../client/features',
    '@widgets': '../client/widgets',
  },
  compatibilityDate: '2025-07-15',

  eslint: {
    config: {
      stylistic: false,
      typescript: {
        strict: true,
      },
    },
  },
});
