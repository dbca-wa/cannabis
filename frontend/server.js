import { serve } from "bun";

// MIME type mapping for common file types
const mimeTypes = {
	".html": "text/html",
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".webp": "image/webp",
};

const getMimeType = (filePath) => {
	const ext = filePath.substring(filePath.lastIndexOf("."));
	return mimeTypes[ext] || "application/octet-stream";
};

const server = serve({
	port: 3000,
	hostname: "0.0.0.0",
	async fetch(req) {
		const url = new URL(req.url);
		let filePath = url.pathname;

		// Default to index.html for SPA routing
		if (filePath === "/" || !filePath.includes(".")) {
			filePath = "/index.html";
		}

		try {
			const file = Bun.file(`./dist${filePath}`);
			if (await file.exists()) {
				const mimeType = getMimeType(filePath);
				const headers = {
					"Content-Type": mimeType,
					"X-Content-Type-Options": "nosniff",
					"X-Frame-Options": "DENY",
					"X-XSS-Protection": "1; mode=block",
					"Referrer-Policy": "strict-origin-when-cross-origin",
					"Permissions-Policy":
						"camera=(), microphone=(), geolocation=(), payment=()",
				};

				// Add caching headers for static assets
				if (
					filePath.match(
						/\.(js|mjs|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp)$/
					)
				) {
					headers["Cache-Control"] = "public, max-age=31536000, immutable";
				} else {
					// HTML and other non-asset files should not be cached
					headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
					headers["Pragma"] = "no-cache";
				}

				return new Response(file, { headers });
			}

			// Fallback to index.html for client-side routing
			const indexFile = Bun.file("./dist/index.html");
			return new Response(indexFile, {
				headers: {
					"Content-Type": "text/html",
					"Cache-Control": "no-store, no-cache, must-revalidate",
					Pragma: "no-cache",
					"X-Content-Type-Options": "nosniff",
					"X-Frame-Options": "DENY",
					"X-XSS-Protection": "1; mode=block",
					"Referrer-Policy": "strict-origin-when-cross-origin",
					"Permissions-Policy":
						"camera=(), microphone=(), geolocation=(), payment=()",
				},
			});
		} catch (error) {
			console.error("Server error:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	},
});

console.log(`🚀 Server running on http://localhost:${server.port}`);
