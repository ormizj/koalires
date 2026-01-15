// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  srcDir: 'client',
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/app/styles/global.css'],

  dir: {
    layouts: 'app/layouts'
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production'
  },
  app: {
    head: {
      script: [
        {
          innerHTML: `(function(){var s=localStorage.getItem('theme');var p=window.matchMedia('(prefers-color-scheme:dark)').matches;if(s==='dark'||(!s&&p)){document.documentElement.classList.add('dark')}})();`,
          type: 'text/javascript'
        }
      ]
    }
  },

  // Feature-Sliced Design auto-imports
  components: [
    { path: '~/shared/ui', prefix: '' },
    { path: '~/entities/**/ui', prefix: '' },
    { path: '~/features/**/ui', prefix: '' },
    { path: '~/widgets/**/ui', prefix: '' },
    '~/components'
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
      'widgets/**/model'
    ]
  },

  alias: {
    '@app': '~/app',
    '@shared': '~/shared',
    '@entities': '~/entities',
    '@features': '~/features',
    '@widgets': '~/widgets'
  }
})
