import { useNavigate, useParams } from "react-router";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/shared/components/ui/dialog";
import { EditDefendantForm } from "./forms";
import { useDefendantById, useUpdateDefendant } from "../hooks/useDefendants";
import type { EditDefendantFormData } from "../schemas/defendantSchemas";

export const EditDefendantRouteModal = () => {
	const navigate = useNavigate();
	const { defendantId } = useParams<{ defendantId: string }>();
	const updateDefendant = useUpdateDefendant();

	const defendantIdNum = defendantId ? parseInt(defendantId, 10) : null;
	const { data: defendant, isLoading } = useDefendantById(defendantIdNum);

	const handleClose = () => {
		navigate("/defendants");
	};

	const handleSubmit = async (data: EditDefendantFormData) => {
		if (!defendantIdNum) return;

		try {
			// Transform form data for API
			const apiData = {
				first_name: data.first_name || null,
				last_name: data.last_name,
			};

			await updateDefendant.mutateAsync({
				id: defendantIdNum,
				data: apiData,
			});
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Failed to update defendant:", error);
		}
	};

	if (isLoading) {
		return (
			<Dialog open={true} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Edit Defendant</DialogTitle>
						<DialogDescription>
							Loading defendant...
						</DialogDescription>
					</DialogHeader>
					<div className="p-6">
						<div className="animate-pulse space-y-4">
							<div className="h-4 bg-gray-200 rounded w-1/4"></div>
							<div className="h-10 bg-gray-200 rounded"></div>
							<div className="h-4 bg-gray-200 rounded w-1/4"></div>
							<div className="h-10 bg-gray-200 rounded"></div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (!defendant) {
		return (
			<Dialog open={true} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Defendant Not Found</DialogTitle>
						<DialogDescription>
							The requested defendant could not be found.
						</DialogDescription>
					</DialogHeader>
					<div className="p-6">
						<p className="text-muted-foreground">
							The defendant you're trying to edit doesn't exist or
							has been deleted.
						</p>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={true} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Defendant</DialogTitle>
					<DialogDescription>
						Update defendant information. Last name is required,
						first name is optional.
					</DialogDescription>
				</DialogHeader>
				<EditDefendantForm
					defendant={defendant}
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isSubmitting={updateDefendant.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
};
