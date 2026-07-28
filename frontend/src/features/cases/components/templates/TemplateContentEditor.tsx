import { useRef, useCallback, useEffect } from "react";
import { TEMPLATE_VARIABLES } from "../../utils/templateResolver";

interface TemplateContentEditorProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
}

/**
 * Rich template content editor using contentEditable.
 *
 * Variables ({{key}}) render as styled inline chips that are atomic — they
 * delete with a single backspace. Clicking a variable button inserts it at the
 * cursor position with a trailing space and retains focus.
 *
 * The underlying value remains a plain string with {{variable}} syntax for
 * storage.
 */
export const TemplateContentEditor = ({
	value,
	onChange,
	placeholder = "Enter template text...",
	disabled = false,
}: TemplateContentEditorProps) => {
	const editorRef = useRef<HTMLDivElement>(null);
	const isInternalUpdate = useRef(false);

	/** Convert plain text with {{var}} to HTML with chip spans. */
	const toHtml = useCallback((text: string): string => {
		if (!text) return "";
		return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
			const variable = TEMPLATE_VARIABLES.find((v) => v.key === key);
			const label = variable?.description ?? key;
			return `<span contenteditable="false" data-variable="${key}" class="template-variable-chip">${label}</span>`;
		});
	}, []);

	/** Convert HTML back to plain text with {{var}} syntax. */
	const toPlainText = useCallback((el: HTMLElement): string => {
		let result = "";
		el.childNodes.forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				result += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const element = node as HTMLElement;
				const variable = element.getAttribute("data-variable");
				if (variable) {
					result += `{{${variable}}}`;
				} else if (element.tagName === "BR") {
					result += "\n";
				} else {
					result += toPlainText(element);
				}
			}
		});
		return result;
	}, []);

	/** Sync the editor DOM from the value prop (only on external changes). */
	useEffect(() => {
		if (isInternalUpdate.current) {
			isInternalUpdate.current = false;
			return;
		}
		const editor = editorRef.current;
		if (!editor) return;
		const currentText = toPlainText(editor);
		if (currentText !== value) {
			editor.innerHTML = toHtml(value);
		}
	}, [value, toHtml, toPlainText]);

	const handleInput = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;
		isInternalUpdate.current = true;
		onChange(toPlainText(editor));
	}, [onChange, toPlainText]);

	/** Insert a variable chip at the current cursor position. */
	const insertVariable = useCallback(
		(key: string) => {
			const editor = editorRef.current;
			if (!editor) return;
			editor.focus();

			const variable = TEMPLATE_VARIABLES.find((v) => v.key === key);
			const label = variable?.description ?? key;

			const chip = document.createElement("span");
			chip.contentEditable = "false";
			chip.setAttribute("data-variable", key);
			chip.className = "template-variable-chip";
			chip.textContent = label;

			const space = document.createTextNode("\u00A0");

			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				range.deleteContents();
				range.insertNode(space);
				range.insertNode(chip);
				// Move cursor after the space
				range.setStartAfter(space);
				range.setEndAfter(space);
				selection.removeAllRanges();
				selection.addRange(range);
			} else {
				editor.appendChild(chip);
				editor.appendChild(space);
			}

			isInternalUpdate.current = true;
			onChange(toPlainText(editor));
		},
		[onChange, toPlainText]
	);

	return (
		<div className="space-y-2">
			<div
				ref={editorRef}
				contentEditable={!disabled}
				suppressContentEditableWarning
				onInput={handleInput}
				data-placeholder={placeholder}
				className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y overflow-auto empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
				role="textbox"
				aria-multiline="true"
				aria-label="Template content"
			/>

			<div className="space-y-1.5">
				<p className="text-xs text-muted-foreground">
					Click a variable to insert it at cursor position:
				</p>
				<div className="flex flex-wrap gap-1.5">
					{TEMPLATE_VARIABLES.map((v) => (
						<button
							key={v.key}
							type="button"
							onClick={() => insertVariable(v.key)}
							className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs hover:bg-accent transition-colors cursor-pointer"
							title={v.description}
							disabled={disabled}
						>
							<span className="font-medium">{v.description}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
};
