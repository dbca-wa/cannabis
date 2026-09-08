// Redirects `require("typescript")` to the TypeScript 6 alias for the current
// process only. This lets ESLint (via typescript-eslint) run on TypeScript 6,
// which it supports, while the rest of the project (tsc build, Vite, editor)
// uses TypeScript 7. See package.json "typescript-6" alias.
//
// typescript-eslint 8.x hard-requires the "typescript" module and offers no
// option to inject a specific TypeScript. Bun only supports top-level
// overrides, so we cannot scope a version override to typescript-eslint alone.
// Intercepting module resolution in the ESLint process is the precise fix.
const Module = require("node:module");

const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
	if (request === "typescript") {
		return originalLoad.call(this, "typescript-6", parent, isMain);
	}
	return originalLoad.call(this, request, parent, isMain);
};
