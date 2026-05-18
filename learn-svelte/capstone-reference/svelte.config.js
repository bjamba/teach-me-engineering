import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV !== 'production';

export default {
  preprocess: [vitePreprocess()],
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      // SPA fallback so the share/[encoded] and embed routes work from a
      // static host without per-route prerendering. The +layout.ts has
      // ssr = false so the client takes over once the shell loads.
      fallback: 'index.html',
      precompress: false,
      strict: true
    }),
    paths: {
      // Set BASE_PATH at build time when deploying to a project Pages site:
      //   BASE_PATH=/svelte-daw npm run build
      base: dev ? '' : (process.env.BASE_PATH ?? '')
    },
    prerender: { handleHttpError: 'warn' }
  }
};
