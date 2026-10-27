/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the build works from any folder (GitHub Pages, local file server).
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The simulations are deterministic but CPU-bound; a busy CI runner can take longer than
    // Vitest's 5 s default (the 10,000-hand test did, and that failed a Pages deploy).
    testTimeout: 60_000,
  },
});
