import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from "vite-plugin-svgr";
import * as path from 'path';

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), svgr()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        // The game server (server/) serves the API under /api itself
        '/api': {
          target: 'http://localhost:3010',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
})
