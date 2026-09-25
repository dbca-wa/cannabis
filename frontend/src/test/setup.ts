import { afterEach, expect, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";

// Extend vitest's expect with the jest-axe accessibility matcher.
expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// localStorage (backed by an in-memory store)
// ---------------------------------------------------------------------------
const storage: Record<string, string> = {};
const localStorageMock = {
	getItem: (key: string) => storage[key] ?? null,
	setItem: (key: string, value: string) => {
		storage[key] = value;
	},
	removeItem: (key: string) => {
		delete storage[key];
	},
	clear: () => {
		Object.keys(storage).forEach((key) => delete storage[key]);
	},
	get length() {
		return Object.keys(storage).length;
	},
	key: (index: number) => Object.keys(storage)[index] ?? null,
};
vi.stubGlobal("localStorage", localStorageMock);

// ---------------------------------------------------------------------------
// Browser APIs jsdom does not implement (needed by Radix UI / charts)
// ---------------------------------------------------------------------------
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

globalThis.ResizeObserver = class ResizeObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
};

globalThis.IntersectionObserver = class IntersectionObserver {
	root = null;
	rootMargin = "";
	thresholds = [];
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
	takeRecords = vi.fn(() => []);
} as unknown as typeof IntersectionObserver;

if (typeof globalThis.requestAnimationFrame === "undefined") {
	globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number =>
		setTimeout(() => cb(Date.now()), 0) as unknown as number;
	globalThis.cancelAnimationFrame = (id: number): void => clearTimeout(id);
}

if (!window.scrollTo) {
	window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
}

Element.prototype.scrollIntoView = vi.fn();

// Radix UI primitives (Select, Dropdown, etc.) call these pointer-capture and
// layout APIs that jsdom does not implement. Polyfill them so those components
// can be exercised in tests rather than throwing.
if (!Element.prototype.hasPointerCapture) {
	Element.prototype.hasPointerCapture = vi.fn(() => false);
}
if (!Element.prototype.setPointerCapture) {
	Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
	Element.prototype.releasePointerCapture = vi.fn();
}

// ---------------------------------------------------------------------------
// Cleanup after every test
// ---------------------------------------------------------------------------
afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.clearAllMocks();
});
