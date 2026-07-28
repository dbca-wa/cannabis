import { useState } from "react";
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
import { useCreateTemplate } from "../../hooks/useSectionCTemplates";
import { TemplateContentEditor } from "./TemplateContentEditor";
import type { ISectionCTemplate } from "../../types/templates.types";

interface CreateTemplateModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Called after successful creation with the new template */
	onCreate?: (template: ISectionCTemplate) => void;
}

export const CreateTemplateModal = ({
	open,
	onOpenChange,
	onCreate,
}: CreateTemplateModalProps) => {
	const [name, setName] = useState("");
	const [content, setContent] = useState("");
	const createMutation = useCreateTemplate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = name.trim();
		const trimmedContent = content.trim();
		if (!trimmedName || !trimmedContent) return;

		const newTemplate = await createMutation.mutateAsync({
			name: trimmedName,
			content: trimmedContent,
		});

		onCreate?.(newTemplate);
		setName("");
		setContent("");
		onOpenChange(false);
	};

	const handleCancel = () => {
		setName("");
		setContent("");
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
						<DialogTitle>Create Section C Template</DialogTitle>
						<DialogDescription>
							Define a reusable template for Section C notes. Click a variable
							to insert case-specific data as a block.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="template-name">Template Name</Label>
							<Input
								id="template-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. Standard subsample note"
								disabled={createMutation.isPending}
							/>
						</div>

						<div className="space-y-2">
							<Label>Content</Label>
							<TemplateContentEditor
								value={content}
								onChange={setContent}
								placeholder="Type template text here. Click variables below to insert them..."
								disabled={createMutation.isPending}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleCancel}
							disabled={createMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={
								!name.trim() || !content.trim() || createMutation.isPending
							}
						>
							{createMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Create Template
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
