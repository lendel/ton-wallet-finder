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
            'no-unused-vars':    'error',
            'no-undef':          'error',
            'no-console':        'off',   // library intentionally uses console for user feedback
            'no-constant-condition': 'error',
            'no-duplicate-case': 'error',
            'eqeqeq':            ['error', 'always'],
            'no-var':            'error',
            'prefer-const':      'error',
        },
    },
];
