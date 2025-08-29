module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/api-tests/jest/**/*.spec.ts'],
  moduleNameMapper: {
    '^@eduhub/shared$': '<rootDir>/libs/shared/src',
    '^@eduhub/shared/(.*)$': '<rootDir>/libs/shared/src/$1'
  },
  maxWorkers: 1,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.jest.json'
    }
  }
};
