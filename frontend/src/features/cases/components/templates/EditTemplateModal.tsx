import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2 } from "lucide-react";
import { useUpdateTemplate } from "../../hooks/useSectionCTemplates";
import { TemplateContentEditor } from "./TemplateContentEditor";
import type { ISectionCTemplate } from "../../types/templates.types";

interface EditTemplateModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	template: ISectionCTemplate | null;
}

export const EditTemplateModal = ({
	open,
	onOpenChange,
	template,
}: EditTemplateModalProps) => {
	const [name, setName] = useState("");
	const [content, setContent] = useState("");
	const updateMutation = useUpdateTemplate();

	useEffect(() => {
		if (template) {
			setName(template.name);
			setContent(template.content);
		}
	}, [template]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!template) return;
		const trimmedName = name.trim();
		const trimmedContent = content.trim();
		if (!trimmedName || !trimmedContent) return;

		await updateMutation.mutateAsync({
			pk: template.id,
			data: { name: trimmedName, content: trimmedContent },
		});
		onOpenChange(false);
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange} modal={true}>
			<DialogContent
				className="sm:max-w-[550px]"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Edit Template</DialogTitle>
						<DialogDescription>
							Update the template name or content. Variables appear as blocks.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-template-name">Template Name</Label>
							<Input
								id="edit-template-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. Standard subsample note"
								disabled={updateMutation.isPending}
							/>
						</div>

						<div className="space-y-2">
							<Label>Content</Label>
							<TemplateContentEditor
								value={content}
								onChange={setContent}
								placeholder="Type template text here..."
								disabled={updateMutation.isPending}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleCancel}
							disabled={updateMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={
								!name.trim() || !content.trim() || updateMutation.isPending
							}
						>
							{updateMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Save Changes
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
