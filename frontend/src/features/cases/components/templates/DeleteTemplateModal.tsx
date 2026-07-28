import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useDeleteTemplate } from "../../hooks/useSectionCTemplates";
import type { ISectionCTemplate } from "../../types/templates.types";

interface DeleteTemplateModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	template: ISectionCTemplate | null;
}

export const DeleteTemplateModal = ({
	open,
	onOpenChange,
	template,
}: DeleteTemplateModalProps) => {
	const deleteMutation = useDeleteTemplate();

	const handleDelete = async () => {
		if (!template) return;
		await deleteMutation.mutateAsync(template.id);
		onOpenChange(false);
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Template</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete &quot;{template?.name}&quot;? This
						action cannot be undone. Existing certificates that used this
						template are not affected.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={deleteMutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{deleteMutation.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
