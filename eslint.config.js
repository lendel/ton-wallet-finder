'use strict';

module.exports = [
    {
        files: ['index.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'commonjs',
            globals: {
                require:  'readonly',
                module:   'readonly',
                exports:  'readonly',
                process:  'readonly',
                Buffer:   'readonly',
                console:  'readonly',
            },
        },
        rules: {
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
        },
    },
    {
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'commonjs',
            globals: {
                require:       'readonly',
                module:        'readonly',
                exports:       'readonly',
                process:       'readonly',
                Buffer:        'readonly',
                console:       'readonly',
                describe:      'readonly',
                it:            'readonly',
                beforeEach:    'readonly',
                afterEach:     'readonly',
                before:        'readonly',
                after:         'readonly',
                AbortController: 'readonly',
                AbortSignal:     'readonly',
                setTimeout:      'readonly',
                clearTimeout:    'readonly',
            },
        },
        rules: {
            'no-unused-vars':        'error',
            'no-undef':              'error',
            'no-console':            'off',
            'no-constant-condition': 'error',
            'no-duplicate-case':     'error',
            'no-throw-literal':      'error',
            'curly':                 ['error', 'all'],
            'eqeqeq':                ['error', 'always'],
            'no-var':                'error',
            'prefer-const':          'error',
        },
    },
];
