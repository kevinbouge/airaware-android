const expoConfig = require('eslint-config-expo/flat');
const sonarjs = require('eslint-plugin-sonarjs');

module.exports = [
  ...expoConfig,
  sonarjs.configs.recommended,
  {
    ignores: ['node_modules/', '.expo/', 'dist/', 'coverage/'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'sonarjs/cognitive-complexity': 'warn',
      'sonarjs/no-nested-functions': 'warn',
      'sonarjs/no-redundant-optional': 'off',
    },
  },
  {
    files: ['plugins/**/*.js'],
    rules: {
      'sonarjs/no-invariant-returns': 'warn',
    },
  },
];
