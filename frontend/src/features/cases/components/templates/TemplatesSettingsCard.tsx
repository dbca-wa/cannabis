import { useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { useSectionCTemplates } from "../../hooks/useSectionCTemplates";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { EditTemplateModal } from "./EditTemplateModal";
import { DeleteTemplateModal } from "./DeleteTemplateModal";
import type { ISectionCTemplate } from "../../types/templates.types";

/**
 * Settings card showing all Section C templates with CRUD actions.
 * Placed on the Settings page below pricing configuration.
 */
export const TemplatesSettingsCard = () => {
	const { data: templates, isLoading } = useSectionCTemplates();
	const [createOpen, setCreateOpen] = useState(false);
	const [editingTemplate, setEditingTemplate] =
		useState<ISectionCTemplate | null>(null);
	const [deletingTemplate, setDeletingTemplate] =
		useState<ISectionCTemplate | null>(null);

	return (
		<>
			<Card className="p-6">
				<div className="flex items-center justify-between mb-5">
					<div>
						<h3>Section C Templates</h3>
						<p className="text-[13px] text-muted-foreground">
							Reusable templates for the &quot;Other Matters&quot; field on
							certificates. Users can select these when processing a case.
						</p>
					</div>
					<Button
						size="sm"
						onClick={() => setCreateOpen(true)}
						className="shrink-0"
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Template
					</Button>
				</div>

				{isLoading ? (
					<p className="text-sm text-muted-foreground">Loading templates...</p>
				) : !templates?.length ? (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
						<FileText className="mb-3 h-10 w-10 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">
							No templates yet. Create one to speed up Section C note entry.
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{templates.map((template) => (
							<div
								key={template.id}
								className="flex items-start justify-between gap-4 rounded-lg border p-3"
							>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium truncate">
										{template.name}
									</p>
									<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
										{template.content}
									</p>
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setEditingTemplate(template)}
										title="Edit template"
										aria-label={`Edit ${template.name}`}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setDeletingTemplate(template)}
										title="Delete template"
										aria-label={`Delete ${template.name}`}
										className="text-destructive hover:text-destructive"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</Card>

			<CreateTemplateModal open={createOpen} onOpenChange={setCreateOpen} />
			<EditTemplateModal
				open={!!editingTemplate}
				onOpenChange={(open) => !open && setEditingTemplate(null)}
				template={editingTemplate}
			/>
			<DeleteTemplateModal
				open={!!deletingTemplate}
				onOpenChange={(open) => !open && setDeletingTemplate(null)}
				template={deletingTemplate}
			/>
		</>
	);
};
