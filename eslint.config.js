const globals = require('globals');
const eslint = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
    eslint.configs.recommended,
    {
        files: ['**/*.{js,ts,tsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: typescriptParser,
            parserOptions: {
                ecmaFeatures: {jsx: true},
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': typescriptPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            'linebreak-style': ['error', 'unix'],
            semi: ['error', 'always'],
            'multiline-ternary': ['error', 'always-multiline'],
            'no-multi-spaces': ['error'],
            'prettier/prettier': 'error',
            ...typescriptPlugin.configs['recommended'].rules,
            ...prettier.rules,
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
