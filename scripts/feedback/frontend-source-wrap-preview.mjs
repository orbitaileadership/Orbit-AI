// Local actual-component fixture only; no application/API/file/provider requests.
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const server = await createServer({
  configFile: false, root: `${root}evidence/frontend-f07/preview`, publicDir: false,
  resolve: { alias: { "@": root } }, esbuild: { jsx: "automatic" },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  server: { host: "127.0.0.1", port: 4317, strictPort: true, fs: { allow: [root] } },
});
await server.listen(); server.printUrls();
