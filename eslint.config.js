const globals = require('globals');
const eslint = require('@eslint/js');
const prettierPlugin = require('eslint-plugin-prettier');
const jestPlugin = require('eslint-plugin-jest');

module.exports = [
    eslint.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
            },
        },
        plugins: {
            prettier: prettierPlugin,
            jest: jestPlugin,
        },
        rules: {
            'linebreak-style': ['error', 'unix'],
            semi: ['error', 'always'],
            'multiline-ternary': ['error', 'always-multiline'],
            'no-multi-spaces': ['error'],
            'prettier/prettier': 'error',
        },
    },
    {
        files: ['**/*.test.js', '**/*.spec.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
    {
        files: ['.eslintrc.{js,cjs}'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.node,
            },
        },
    },
];
