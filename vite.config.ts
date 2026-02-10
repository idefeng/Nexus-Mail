import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'electron',
                'imap-simple',
                'mailparser',
                'nodemailer',
                'tls',
                'net',
                'fs',
                'path',
                'crypto',
                'node:fs',
                'node:path',
                'node:crypto',
                'node:url',
                'node:path',
                'node:os',
                'util',
                'stream',
                'events',
                'buffer',
              ],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                entryFileNames: 'preload.js', // Force correct filename
              },
            },
          },
        },
      },
    }),
  ],
})
