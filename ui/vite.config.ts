import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      "@qb-toolkit/core": path.resolve(__dirname, "../packages/core/src"),
      "@qb-toolkit/bank-recon": path.resolve(__dirname, "../packages/bank-recon/src"),
    },
  },
});
