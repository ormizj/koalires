// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', '@nuxt/eslint'],

  // Feature-Sliced Design auto-imports
  components: [
    { path: '~/shared/ui', prefix: '' },
    { path: '~/entities/**/ui', prefix: '' },
    { path: '~/features/**/ui', prefix: '' },
    { path: '~/widgets/**/ui', prefix: '' },
    '~/components',
  ],

  imports: {
    dirs: [
      'shared/lib',
      'shared/api',
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
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  },

  dir: {
    layouts: 'app/layouts',
  },
  srcDir: 'client',

  alias: {
    '@app': '~/app',
    '@shared': '~/shared',
    '@entities': '~/entities',
    '@features': '~/features',
    '@widgets': '~/widgets',
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
})
