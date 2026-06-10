import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// CSP Configuration — production values replace the dev meta tag during build
// Note: 'unsafe-inline' is needed for the theme detection script in index.html.
// connect-src uses 'self' which covers same-origin API calls (no hardcoded domain needed).
const CSP_PRODUCTION = {
	defaultSrc: ["'self'"],
	scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
	workerSrc: ["'self'", "blob:"],
	styleSrc: ["'self'", "'unsafe-inline'"],
	imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
	fontSrc: ["'self'", "data:"],
	connectSrc: ["'self'", "https://*.ingest.us.sentry.io"],
	frameSrc: ["'self'", "blob:"],
	objectSrc: ["'none'"],
	baseUri: ["'self'"],
	formAction: ["'self'"],
};

/**
 * Generate CSP string from configuration object.
 */
function generateCSP(config: Record<string, string[]>): string {
	const directiveMap: Record<string, string> = {
		defaultSrc: "default-src",
		scriptSrc: "script-src",
		workerSrc: "worker-src",
		styleSrc: "style-src",
		imgSrc: "img-src",
		fontSrc: "font-src",
		connectSrc: "connect-src",
		frameSrc: "frame-src",
		objectSrc: "object-src",
		baseUri: "base-uri",
		formAction: "form-action",
	};

	return Object.entries(config)
		.filter(([key]) => directiveMap[key])
		.map(([key, values]) => `${directiveMap[key]} ${values.join(" ")}`)
		.join("; ");
}

// https://vite.dev/config/
export default defineConfig({
	server: {
		host: "127.0.0.1",
		port: 3000,
	},
	preview: {
		host: true,
		port: 3000,
	},
	build: {
		minify: true,
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks(id: string) {
					if (id.includes("node_modules/react-dom")) return "vendor-react";
					if (id.includes("node_modules/react/")) return "vendor-react";
					if (id.includes("node_modules/react-router")) return "vendor-react";
					if (id.includes("node_modules/@tanstack/react-query"))
						return "vendor-query";
					if (id.includes("node_modules/mobx")) return "vendor-mobx";
					if (id.includes("node_modules/lucide-react")) return "vendor-ui";
					if (id.includes("node_modules/sonner")) return "vendor-ui";
					if (id.includes("node_modules/motion")) return "vendor-ui";
					if (id.includes("node_modules/recharts")) return "vendor-charts";
				},
			},
		},
	},
	plugins: [
		react(),
		tailwindcss(),
		// Replace the dev CSP meta tag with production CSP during build
		{
			name: "html-csp-transform",
			transformIndexHtml(html) {
				if (process.env.NODE_ENV !== "production") return html;

				const csp = generateCSP(CSP_PRODUCTION);
				return html.replace(
					/<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>[\s\S]*?(?=\s*<)/,
					`<meta http-equiv="Content-Security-Policy" content="${csp}" />`
				);
			},
		},
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setup.ts",
		passWithNoTests: true,
		testTimeout: 20000,
		hookTimeout: 20000,
		teardownTimeout: 20000,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "json-summary", "html", "lcov"],
			exclude: [
				"node_modules/",
				"src/test/",
				"**/*.test.ts",
				"**/*.test.tsx",
				"**/*.d.ts",
				"**/types/",
			],
			thresholds: process.env.CI
				? undefined
				: {
						lines: 40,
						functions: 40,
						branches: 40,
						statements: 40,
					},
		},
	},
});
