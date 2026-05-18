import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

const dev = process.env.NODE_ENV !== 'production';

export default {
  extensions: ['.svelte', '.svx', '.md'],
  preprocess: [
    vitePreprocess(),
    mdsvex({
      extensions: ['.svx', '.md'],
      smartypants: { dashes: 'oldschool' }
    })
  ],
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: true
    }),
    paths: {
      // For project-Pages hosting at https://<user>.github.io/learn-svelte/
      // override the base in production by setting BASE_PATH at build time.
      base: dev ? '' : process.env.BASE_PATH ?? ''
    },
    prerender: { handleHttpError: 'warn' }
  }
};
