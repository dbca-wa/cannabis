import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, PencilLine } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { useSectionCTemplates } from "../../hooks/useSectionCTemplates";
import {
	resolveTemplate,
	buildTemplateContext,
	canResolveTemplate,
} from "../../utils/templateResolver";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { EditTemplateModal } from "./EditTemplateModal";
import type { DrugBag } from "../../types/drugBags.types";
import type { ISectionCTemplate } from "../../types/templates.types";

// Sentinel value for the "no template / free typing" state, so the Select stays
// controlled (a bare undefined value flips it between controlled and
// uncontrolled, which breaks reselecting a template afterwards).
const FREE_VALUE = "__free__";

interface TemplatePickerProps {
	/** Current case data for variable resolution */
	caseData: Record<string, unknown> | null;
	/** Drug bags on the current form (for context) */
	bags: DrugBag[];
	/** The current Section C note text, so the picker can detect free typing */
	currentValue: string;
	/** Called with the resolved template text when user selects a template */
	onApply: (resolvedText: string) => void;
}

export const TemplatePicker = ({
	caseData,
	bags,
	currentValue,
	onApply,
}: TemplatePickerProps) => {
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [editingTemplate, setEditingTemplate] =
		useState<ISectionCTemplate | null>(null);
	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
	const { data: templates, isLoading } = useSectionCTemplates();

	// The exact text this picker last emitted, so the re-resolve effect can tell
	// its own output apart from a manual edit and never clobber the latter.
	const lastAppliedRef = useRef<string | null>(null);

	// The text we most recently asked the parent to apply but have not yet seen
	// echoed back into `currentValue`. Until it arrives, the stale `currentValue`
	// must not be mistaken for a hand edit.
	const pendingApplyRef = useRef<string | null>(null);

	const applyTemplate = (template: ISectionCTemplate) => {
		const context = buildTemplateContext(caseData, bags);
		const resolved = resolveTemplate(template.content, context);
		lastAppliedRef.current = resolved;
		pendingApplyRef.current = resolved;
		onApply(resolved);
	};

	const handleTemplateSelect = (templateId: string) => {
		if (templateId === FREE_VALUE) {
			// Explicitly choosing "Free typing" just detaches from any template.
			setSelectedId(undefined);
			setFreeTyping(true);
			lastAppliedRef.current = null;
			return;
		}
		setSelectedId(templateId);
		setFreeTyping(false);
		const template = templates?.find((t) => String(t.id) === templateId);
		if (!template) return;
		applyTemplate(template);
	};

	// Re-resolve the selected template whenever the data it depends on changes —
	// editing a bag, adding one, or removing one — so the note stays in step with
	// the bags rather than showing stale values until the template is reselected.
	// The trigger is the resolved text changing, not the kind of change, so any
	// edit that affects the output is covered. Only re-applies when the freshly
	// resolved text differs from what this picker last emitted, so a manual edit
	// to the note is left untouched.
	const selectedTemplate = templates?.find((t) => String(t.id) === selectedId);
	const resolvedForCurrentData = selectedTemplate
		? resolveTemplate(
				selectedTemplate.content,
				buildTemplateContext(caseData, bags)
			)
		: null;

	// True once the user has hand-edited away from a template, cleared when they
	// pick a template again. Drives the "Free typing" notice.
	const [freeTyping, setFreeTyping] = useState(false);

	// Watch the note for hand edits. The note is a manual edit when it no longer
	// matches the exact text this picker last emitted (not the current
	// resolution, which distinguishes an edit from a pending bag-driven
	// re-resolve). A pending apply that has not yet echoed back is not an edit.
	// All ref access lives in this effect — refs must not be touched in render.
	useEffect(() => {
		if (
			pendingApplyRef.current !== null &&
			currentValue === pendingApplyRef.current
		) {
			// The apply has landed; trust currentValue again.
			pendingApplyRef.current = null;
			return;
		}
		const hasFreeTyped =
			selectedId !== undefined &&
			lastAppliedRef.current !== null &&
			pendingApplyRef.current === null &&
			currentValue !== lastAppliedRef.current;
		if (hasFreeTyped) {
			// Drop the template so a later bag update cannot overwrite the custom
			// wording, and surface the free-typing notice.
			setSelectedId(undefined);
			setFreeTyping(true);
			lastAppliedRef.current = null;
		}
	}, [currentValue, selectedId]);

	useEffect(() => {
		if (resolvedForCurrentData === null) return;
		if (resolvedForCurrentData === lastAppliedRef.current) return;
		lastAppliedRef.current = resolvedForCurrentData;
		pendingApplyRef.current = resolvedForCurrentData;
		onApply(resolvedForCurrentData);
		// onApply is stable enough here; re-run only when the resolved text changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [resolvedForCurrentData]);

	const handleCreated = (newTemplate: ISectionCTemplate) => {
		setSelectedId(String(newTemplate.id));
		setFreeTyping(false);
		applyTemplate(newTemplate);
	};

	const handleEditClick = () => {
		if (!selectedId || !templates) return;
		const template = templates.find((t) => String(t.id) === selectedId);
		if (template) setEditingTemplate(template);
	};

	return (
		<>
			<div className="space-y-1.5">
				<Label className="text-xs text-muted-foreground">Use Template</Label>
				<div className="flex items-center gap-2">
					<Select
						value={selectedId ?? (freeTyping ? FREE_VALUE : undefined)}
						onValueChange={handleTemplateSelect}
					>
						<SelectTrigger className="flex-1" disabled={isLoading}>
							<SelectValue
								placeholder={
									isLoading
										? "Loading templates..."
										: templates?.length
											? "Select a template..."
											: "No templates yet"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{freeTyping && (
								<SelectItem value={FREE_VALUE}>
									Free typing (no template)
								</SelectItem>
							)}
							{templates?.map((t) => {
								const context = buildTemplateContext(caseData, bags);
								const canResolve = canResolveTemplate(t.content, context);
								return (
									<SelectItem
										key={t.id}
										value={String(t.id)}
										disabled={!canResolve}
										className={!canResolve ? "opacity-50" : ""}
									>
										{t.name}
										{!canResolve && (
											<span className="ml-2 text-xs text-muted-foreground">
												(missing data)
											</span>
										)}
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={handleEditClick}
						title="Edit selected template"
						aria-label="Edit selected template"
						disabled={!selectedId}
					>
						<Pencil className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => setCreateModalOpen(true)}
						title="Create new template"
						aria-label="Create new template"
					>
						<Plus className="h-4 w-4" />
					</Button>
				</div>

				{/* Shown only after the user edits away from a template: the note is
				    now their own text and will not be updated when bags change. */}
				{freeTyping && (
					<p
						role="status"
						className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"
					>
						<PencilLine className="h-3.5 w-3.5 shrink-0" />
						Free typing — your edits won't be replaced when bags change. Pick a
						template to switch back.
					</p>
				)}
			</div>

			<CreateTemplateModal
				open={createModalOpen}
				onOpenChange={setCreateModalOpen}
				onCreate={handleCreated}
			/>
			<EditTemplateModal
				open={!!editingTemplate}
				onOpenChange={(open) => !open && setEditingTemplate(null)}
				template={editingTemplate}
			/>
		</>
	);
};
