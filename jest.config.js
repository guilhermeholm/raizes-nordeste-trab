module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/env.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { types: ['node', 'jest'] }, diagnostics: { warnOnly: false } }] },
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
};
