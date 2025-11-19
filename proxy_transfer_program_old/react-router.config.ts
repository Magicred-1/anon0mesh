import type { Config } from "@react-router/dev/config";

export default {
  basename: process.env['CODIGO_BASE_URL'],

  // Config options...
  // Server-side render by default, to enable SPA mode set this to false
  ssr: false,
} satisfies Config;