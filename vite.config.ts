import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from "vite-plugin-svgr";
import * as path from 'path';

const normalizeBasePath = (value: string) => {
  if (!value || value === "/") {
    return "/";
  }

  const trimmed = value.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? `${trimmed}/` : `/${trimmed}/`;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || "/"),
    plugins: [react(), svgr()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_DEV_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (proxyPath) => proxyPath.replace(/^\/api/, ''),
        },
      },
    },
  };
})
