import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    '@stylistic/no-trailing-spaces': 'error',
    '@stylistic/eol-last': 'error',
    '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
  },
})
