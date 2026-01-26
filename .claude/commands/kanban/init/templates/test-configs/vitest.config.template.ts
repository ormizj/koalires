import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import vue from '@vitejs/plugin-vue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [vue()],
  test: {
    // Enable global test APIs (describe, it, expect)
    globals: true,

    // Use happy-dom for faster DOM simulation (lighter than jsdom)
    environment: 'happy-dom',

    // Test file patterns
    include: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],

    // Exclude directories
    exclude: ['node_modules', '.nuxt', '.output', 'dist'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.nuxt/**',
        '.output/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
    },

    // Setup files (uncomment and create if needed)
    // setupFiles: ['./test/setup.ts'],

    // Test timeout in milliseconds
    testTimeout: 10000,

    // Hook timeout in milliseconds
    hookTimeout: 10000,
  },

  resolve: {
    alias: {
      // Standard Nuxt aliases
      '~': resolve(__dirname, './'),
      '~~': resolve(__dirname, './'),
      '@': resolve(__dirname, './'),

      // FSD layer aliases (adjust paths based on your srcDir)
      // '@app': resolve(__dirname, './client/app'),
      // '@shared': resolve(__dirname, './client/shared'),
      // '@entities': resolve(__dirname, './client/entities'),
      // '@features': resolve(__dirname, './client/features'),
      // '@widgets': resolve(__dirname, './client/widgets'),
    },
  },
});
