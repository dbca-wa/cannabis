import { useRef, useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import { TEMPLATE_VARIABLES } from "../../utils/templateResolver";
import {
	templateHtmlToPlainText as toPlainText,
	templateTextToHtml as toHtml,
} from "./templateEditorText";

/** Group variables by category for the UI. */
const VARIABLE_GROUPS: {
	label: string;
	keys: string[];
}[] = [
	{
		label: "Case",
		keys: [
			"case_number",
			"received_date",
			"defendant_name",
			"conveying_officer",
			"requesting_officer",
		],
	},
	{
		label: "Bags",
		keys: ["bag_count", "tag_numbers", "new_tag_numbers", "content_types"],
	},
	{
		label: "Female Plants",
		keys: [
			"female_plant_tags",
			"non_female_plant_tags",
			"female_plant_count",
			"non_female_plant_count",
		],
	},
	{
		label: "Other",
		keys: ["security_movement_envelope"],
	},
];

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
	const [isFocused, setIsFocused] = useState(false);

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
	}, [value]);

	const handleInput = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) return;
		isInternalUpdate.current = true;
		onChange(toPlainText(editor));
	}, [onChange]);

	/**
	 * Paste as plain text.
	 *
	 * Pasting rich content would drop styled markup into the editor, which
	 * serialises to text the author never typed. Newlines in the pasted text are
	 * preserved as line breaks.
	 */
	const handlePaste = useCallback(
		(event: React.ClipboardEvent<HTMLDivElement>) => {
			event.preventDefault();
			const text = event.clipboardData.getData("text/plain");
			if (!text) return;

			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0) return;

			const range = selection.getRangeAt(0);
			range.deleteContents();

			// Build a fragment so multi-line pastes keep their breaks.
			const fragment = document.createDocumentFragment();
			text.split("\n").forEach((line, index) => {
				if (index > 0) fragment.appendChild(document.createElement("br"));
				if (line) fragment.appendChild(document.createTextNode(line));
			});

			const lastNode = fragment.lastChild;
			range.insertNode(fragment);
			if (lastNode) {
				range.setStartAfter(lastNode);
				range.setEndAfter(lastNode);
				selection.removeAllRanges();
				selection.addRange(range);
			}

			handleInput();
		},
		[handleInput]
	);

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
		[onChange]
	);

	const hasContent = value.trim().length > 0;

	return (
		<div className="space-y-2">
			<div className="relative">
				<div
					ref={editorRef}
					contentEditable={!disabled}
					suppressContentEditableWarning
					onInput={handleInput}
					onPaste={handlePaste}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					data-placeholder={placeholder}
					className={cn(
						// A visible, input-like boundary so the writing area is
						// unmistakable, with a clear focus ring on top of it.
						"min-h-[140px] w-full rounded-md border-2 bg-background px-3 py-2 pr-9 text-sm",
						"whitespace-pre-wrap break-words overflow-auto resize-y",
						"focus-visible:outline-none",
						"empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
						"disabled:cursor-not-allowed disabled:opacity-50",
						isFocused
							? "border-emerald-500 ring-2 ring-emerald-500/25"
							: "border-input hover:border-muted-foreground/50"
					)}
					role="textbox"
					aria-multiline="true"
					aria-label="Template content"
				/>
				{hasContent && (
					<span
						className="pointer-events-none absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50"
						aria-hidden="true"
					>
						<Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
					</span>
				)}
			</div>
			<p className="text-xs text-muted-foreground">
				Press Enter for a new line. Line breaks are kept on the certificate.
			</p>

			<div className="space-y-2">
				<p className="text-xs text-muted-foreground font-medium">
					Insert variable at cursor:
				</p>
				{VARIABLE_GROUPS.map((group) => (
					<div key={group.label} className="space-y-1">
						<p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
							{group.label}
						</p>
						<div className="flex flex-wrap gap-1.5">
							{group.keys.map((key) => {
								const v = TEMPLATE_VARIABLES.find((tv) => tv.key === key);
								if (!v) return null;
								return (
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
								);
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
