import { describe, it, expect } from "vitest";
import {
	templateHtmlToPlainText,
	templateTextToHtml,
} from "./templateEditorText";

/** Build a detached element with the given innerHTML, as the editor would hold. */
const editorWith = (html: string): HTMLElement => {
	const el = document.createElement("div");
	el.innerHTML = html;
	return el;
};

describe("templateHtmlToPlainText", () => {
	it("reads plain text unchanged", () => {
		expect(templateHtmlToPlainText(editorWith("Some notes"))).toBe(
			"Some notes"
		);
	});

	it("turns a variable chip back into its placeholder", () => {
		const html =
			'Bags <span data-variable="tag_numbers" class="template-variable-chip">Tags</span> sealed';
		expect(templateHtmlToPlainText(editorWith(html))).toBe(
			"Bags {{tag_numbers}} sealed"
		);
	});

	it("reads a br as a newline", () => {
		expect(templateHtmlToPlainText(editorWith("one<br>two"))).toBe("one\ntwo");
	});

	// The bug: browsers wrap each line in a div when Enter is pressed, and those
	// were previously flattened into a single line.
	it("separates div-wrapped lines with newlines", () => {
		const html = "<div>first</div><div>second</div><div>third</div>";
		expect(templateHtmlToPlainText(editorWith(html))).toBe(
			"first\nsecond\nthird"
		);
	});

	it("separates p-wrapped lines with newlines", () => {
		expect(templateHtmlToPlainText(editorWith("<p>a</p><p>b</p>"))).toBe(
			"a\nb"
		);
	});

	it("does not prefix a leading newline for the first block", () => {
		expect(templateHtmlToPlainText(editorWith("<div>only</div>"))).toBe("only");
	});

	it("handles a first bare line followed by div lines", () => {
		expect(templateHtmlToPlainText(editorWith("first<div>second</div>"))).toBe(
			"first\nsecond"
		);
	});

	it("keeps inline wrappers on the same line", () => {
		const html = "<span>a</span><strong>b</strong>";
		expect(templateHtmlToPlainText(editorWith(html))).toBe("ab");
	});

	it("preserves a variable inside a div-wrapped line", () => {
		const html =
			'<div>Sealed into <span data-variable="new_tag_numbers">New tags</span></div><div>Done</div>';
		expect(templateHtmlToPlainText(editorWith(html))).toBe(
			"Sealed into {{new_tag_numbers}}\nDone"
		);
	});
});

describe("templateTextToHtml", () => {
	it("renders newlines as line breaks", () => {
		expect(templateTextToHtml("one\ntwo")).toBe("one<br>two");
	});

	it("renders a variable as a chip carrying its key", () => {
		expect(templateTextToHtml("{{tag_numbers}}")).toContain(
			'data-variable="tag_numbers"'
		);
	});

	it("returns an empty string for empty input", () => {
		expect(templateTextToHtml("")).toBe("");
	});
});

describe("round trip", () => {
	it("preserves multi-line content with variables through both conversions", () => {
		const original =
			"Subsamples sealed into {{new_tag_numbers}}.\nEnvelope {{security_movement_envelope}}.\nHanded back.";
		const restored = templateHtmlToPlainText(
			editorWith(templateTextToHtml(original))
		);
		expect(restored).toBe(original);
	});

	it("preserves consecutive blank lines", () => {
		const original = "a\n\nb";
		const restored = templateHtmlToPlainText(
			editorWith(templateTextToHtml(original))
		);
		expect(restored).toBe(original);
	});
});
