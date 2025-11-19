import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const CODIGO_BASE_URL = process.env['CODIGO_BASE_URL']
const LOCAL_VALIDATOR_PATH = `${CODIGO_BASE_URL}/local-validator`

export default defineConfig({
  base: CODIGO_BASE_URL,
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  define: {
    'process.env.ANCHOR_BROWSER': true
  },
  server: {
    proxy: {
      [LOCAL_VALIDATOR_PATH]: {
        target: 'http://local-validator:8899',
        changeOrigin: true,
        rewrite: () => '/'
      },
    }
  }
});