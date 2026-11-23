/** @type {import('prettier').Config} */
export default {
    plugins: ['prettier-plugin-astro'],
    printWidth: 150,
    tabWidth: 4,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'all',
    overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
