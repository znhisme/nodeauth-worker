import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: '.',
    resolve: {
        alias: [
            {
                find: '@',
                replacement: fileURLToPath(new URL('../src', import.meta.url)),
            },
            {
                find: /^drizzle-orm$/,
                replacement: fileURLToPath(new URL('./node_modules/drizzle-orm', import.meta.url)),
            },
            {
                find: /^drizzle-orm\/(.*)$/,
                replacement: fileURLToPath(new URL('./node_modules/drizzle-orm/$1', import.meta.url)),
            },
        ],
    },
    test: {
        environment: 'node',
        include: ['../src/**/*.test.ts'],
    },
});
