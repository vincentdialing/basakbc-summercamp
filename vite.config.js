import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
        adminDashboard: resolve(__dirname, "admin-dashboard.html"),
        adminTable: resolve(__dirname, "admin-table.html"),
        adminWheel: resolve(__dirname, "admin-wheel.html"),
        adminTeams: resolve(__dirname, "admin-teams.html"),
        adminCertificates: resolve(__dirname, "admin-certificates.html")
      }
    }
  }
});
