import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tanstackStart({
			srcDirectory: "app",
		}),
		cloudflare(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("./app", import.meta.url)),
		},
	},
});
