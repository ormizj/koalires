/** @type {import('jest').Config} */
const config = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'jsdom',

  // Root directories for tests
  roots: ['<rootDir>'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],

  // Transform TypeScript files
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Module path aliases (adjust based on your project)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
    // FSD layer aliases (uncomment and adjust as needed)
    // '^@app/(.*)$': '<rootDir>/client/app/$1',
    // '^@shared/(.*)$': '<rootDir>/client/shared/$1',
    // '^@entities/(.*)$': '<rootDir>/client/entities/$1',
    // '^@features/(.*)$': '<rootDir>/client/features/$1',
    // '^@widgets/(.*)$': '<rootDir>/client/widgets/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    '**/*.{ts,tsx,js,jsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.nuxt/**',
    '!**/dist/**',
    '!**/*.config.*',
  ],

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Files to ignore
  testPathIgnorePatterns: ['/node_modules/', '/.nuxt/', '/dist/', '/.output/'],

  // Setup files (uncomment and create if needed)
  // setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,
};

module.exports = config;
