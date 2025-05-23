import { serve } from "bun";

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
				return new Response(file);
			}
			// Fallback to index.html for client-side routing
			const indexFile = Bun.file("./dist/index.html");
			return new Response(indexFile);
		} catch (error) {
			return new Response("File not found", { status: 404 });
		}
	},
});

console.log(`Server running on http://localhost:${server.port}`);
