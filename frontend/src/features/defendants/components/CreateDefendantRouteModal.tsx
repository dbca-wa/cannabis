import { useNavigate } from "react-router";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/shared/components/ui/dialog";
import { CreateDefendantForm } from "./forms";
import { useCreateDefendant } from "../hooks/useDefendants";
import type { CreateDefendantFormData } from "../schemas/defendantSchemas";

export const CreateDefendantRouteModal = () => {
	const navigate = useNavigate();
	const createDefendant = useCreateDefendant();

	const handleClose = () => {
		navigate("/defendants");
	};

	const handleSubmit = async (data: CreateDefendantFormData) => {
		try {
			// Transform form data for API
			const apiData = {
				first_name: data.first_name || null,
				last_name: data.last_name,
			};

			await createDefendant.mutateAsync(apiData);
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Failed to create defendant:", error);
		}
	};

	return (
		<Dialog open={true} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Create New Defendant</DialogTitle>
					<DialogDescription>
						Add a new defendant to the system. Last name is
						required, first name is optional.
					</DialogDescription>
				</DialogHeader>
				<CreateDefendantForm
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isSubmitting={createDefendant.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
};
