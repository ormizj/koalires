import { defineNuxtModule, addComponentsDir } from '@nuxt/kit'
import { globSync } from 'tinyglobby'
import { resolve } from 'path'

export default defineNuxtModule({
  meta: {
    name: 'fsd-components',
  },
  setup(_, nuxt) {
    const srcDir = nuxt.options.srcDir

    // FSD layers to scan for ui directories
    const layers = ['entities', 'features', 'widgets']

    for (const layer of layers) {
      const pattern = `${layer}/**/ui`
      const dirs = globSync(pattern, {
        cwd: srcDir,
        onlyDirectories: true,
      })

      for (const dir of dirs) {
        addComponentsDir({
          path: resolve(srcDir, dir),
          prefix: '',
          ignore: ['index.ts'],
        })
      }
    }

    // Shared UI (always exists)
    addComponentsDir({
      path: resolve(srcDir, 'shared/ui'),
      prefix: '',
      ignore: ['index.ts'],
    })
  },
})
