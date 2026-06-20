import { defineConfig } from 'vite'

export default defineConfig({
  base: '/trainer/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})
