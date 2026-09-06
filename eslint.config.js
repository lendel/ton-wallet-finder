'use strict';

const js      = require('@eslint/js');
const globals = require('globals');

// Layered on top of `js.configs.recommended`, which already covers
// no-unused-vars, no-undef, no-constant-condition, no-duplicate-case, …
const rules = {
    'no-console':                   'off',   // library intentionally uses console for user feedback
    'curly':                        ['error', 'all'],
    'eqeqeq':                       ['error', 'always'],
    'no-implicit-coercion':         'error',
    'no-shadow':                    'error',
    'no-throw-literal':             'error',
    'no-var':                       'error',
    'object-shorthand':             ['error', 'properties'],
    'prefer-const':                 'error',
    'prefer-promise-reject-errors': 'error',
    'require-atomic-updates':       'error',
};

module.exports = [
    {
        ignores: ['node_modules/**', 'coverage/**'],
    },

    js.configs.recommended,

    {
        rules,
    },

    {
        // CommonJS sources and this config file itself.
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType:  'commonjs',
            globals:     globals.node,
        },
    },

    {
        files: ['test/**/*.js'],
        languageOptions: {
            globals: { ...globals.node, ...globals.mocha },
        },
    },

    {
        files: ['test/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType:  'module',
            globals:     { ...globals.node, ...globals.mocha },
        },
    },
];
