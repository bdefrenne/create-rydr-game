import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3400 }, // pick an unused port (racing 3000, GH 3200, tower-defense 3300)
});
