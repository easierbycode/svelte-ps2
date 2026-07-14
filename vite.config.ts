// Dev server for the demo/ app (which imports the library straight from
// ../src). Root is resolved from this file so the server works from any cwd.

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./demo', import.meta.url)),
  server: {
    port: 5180,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
  },
})
