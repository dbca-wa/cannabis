import { TEMPLATE_VARIABLES } from "../../utils/templateResolver";

/**
 * Conversions between the template's stored form — plain text with
 * {{variable}} placeholders — and the contentEditable DOM the author works in.
 *
 * Kept apart from the component so the round trip can be tested directly: the
 * editor's whole job is to survive this conversion without losing anything.
 */

/**
 * Elements a browser creates to represent a new line inside a contentEditable.
 *
 * Pressing Enter does not insert a <br>: depending on the browser it wraps each
 * line in a <div> or a <p>. Recursing into those without emitting a separator
 * silently joined the lines back together, which is why line breaks did not
 * survive a save.
 */
const BLOCK_TAGS = new Set([
	"DIV",
	"P",
	"LI",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
]);

/** Convert stored template text into editor HTML, with variables as chips. */
export const templateTextToHtml = (text: string): string => {
	if (!text) return "";

	const withChips = text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
		const variable = TEMPLATE_VARIABLES.find((v) => v.key === key);
		const label = variable?.description ?? key;
		return `<span contenteditable="false" data-variable="${key}" class="template-variable-chip">${label}</span>`;
	});

	return withChips.replace(/\n/g, "<br>");
};

/** Read the editor DOM back as stored template text. */
export const templateHtmlToPlainText = (el: HTMLElement): string => {
	let result = "";

	el.childNodes.forEach((node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			result += node.textContent ?? "";
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const element = node as HTMLElement;
		const variable = element.getAttribute("data-variable");

		if (variable) {
			result += `{{${variable}}}`;
			return;
		}
		if (element.tagName === "BR") {
			result += "\n";
			return;
		}
		if (BLOCK_TAGS.has(element.tagName)) {
			// Separate blocks rather than prefixing the first one.
			if (result && !result.endsWith("\n")) result += "\n";
			result += templateHtmlToPlainText(element);
			return;
		}
		// Inline wrapper (span, strong, em) — keep its text on the same line.
		result += templateHtmlToPlainText(element);
	});

	return result;
};
