import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
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
} from "../../utils/templateResolver";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { EditTemplateModal } from "./EditTemplateModal";
import type { DrugBag } from "../../types/drugBags.types";
import type { ISectionCTemplate } from "../../types/templates.types";

interface TemplatePickerProps {
	/** Current case data for variable resolution */
	caseData: Record<string, unknown> | null;
	/** Drug bags on the current form (for context) */
	bags: DrugBag[];
	/** Called with the resolved template text when user selects a template */
	onApply: (resolvedText: string) => void;
}

export const TemplatePicker = ({
	caseData,
	bags,
	onApply,
}: TemplatePickerProps) => {
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [editingTemplate, setEditingTemplate] =
		useState<ISectionCTemplate | null>(null);
	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
	const { data: templates, isLoading } = useSectionCTemplates();

	const handleTemplateSelect = (templateId: string) => {
		setSelectedId(templateId);
		const template = templates?.find((t) => String(t.id) === templateId);
		if (!template) return;

		const context = buildTemplateContext(caseData, bags);
		const resolved = resolveTemplate(template.content, context);
		onApply(resolved);
	};

	const handleCreated = (newTemplate: ISectionCTemplate) => {
		setSelectedId(String(newTemplate.id));
		const context = buildTemplateContext(caseData, bags);
		const resolved = resolveTemplate(newTemplate.content, context);
		onApply(resolved);
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
					<Select value={selectedId} onValueChange={handleTemplateSelect}>
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
							{templates?.map((t) => (
								<SelectItem key={t.id} value={String(t.id)}>
									{t.name}
								</SelectItem>
							))}
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
