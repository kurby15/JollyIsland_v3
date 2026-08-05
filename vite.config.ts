import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id: string) {
      if (!id.startsWith("figma:asset/")) {
        return;
      }

      const filename = id.replace("figma:asset/", "");

      return path.resolve(currentDir, "src/assets", filename);
    },
  };
}

export default defineConfig({
  base: "/",

  plugins: [
    figmaAssetResolver(),

    // Required plugins
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(currentDir, "./src"),
    },
  },

  assetsInclude: ["**/*.svg", "**/*.csv"],
});
