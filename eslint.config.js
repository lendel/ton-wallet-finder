'use strict';

const rules = {
    'no-unused-vars':        'error',
    'no-undef':              'error',
    'no-console':            'off',   // library intentionally uses console for user feedback
    'no-constant-condition': 'error',
    'no-duplicate-case':     'error',
    'no-throw-literal':      'error',
    'curly':                 ['error', 'all'],
    'eqeqeq':                ['error', 'always'],
    'no-var':                'error',
    'prefer-const':          'error',
};

const nodeGlobals = {
    require:         'readonly',
    module:          'readonly',
    exports:         'readonly',
    process:         'readonly',
    Buffer:          'readonly',
    console:         'readonly',
    AbortController: 'readonly',
    AbortSignal:     'readonly',
    setTimeout:      'readonly',
    clearTimeout:    'readonly',
};

const mochaGlobals = {
    describe:   'readonly',
    it:         'readonly',
    beforeEach: 'readonly',
    afterEach:  'readonly',
    before:     'readonly',
    after:      'readonly',
};

module.exports = [
    {
        files: ['index.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'commonjs',
            globals:     nodeGlobals,
        },
        rules,
    },
    {
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'commonjs',
            globals:     { ...nodeGlobals, ...mochaGlobals },
        },
        rules,
    },
    {
        files: ['test/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'module',
            globals:     { ...nodeGlobals, ...mochaGlobals },
        },
        rules,
    },
];
