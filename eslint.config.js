const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['server.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    files: ['public/js/game/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        WebSocket: 'readonly',
        console: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Audio: 'readonly',
        URLSearchParams: 'readonly',
        Image: 'readonly',
        containsProfanity: 'readonly',
      },
    },
  },
  {
    files: ['public/js/profanity.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        module: 'writable',
        window: 'writable',
      },
    },
  },
];
