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
import type { DefendantTiny } from "@/shared/types/backend-api.types";

interface CreateDefendantModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional callback when defendant is successfully created */
	onCreate?: (defendant: DefendantTiny) => void;
	/** If true, will navigate to /defendants on close (for route-based modals) */
	isRouteModal?: boolean;
}

export const CreateDefendantModal: React.FC<CreateDefendantModalProps> = ({
	open,
	onOpenChange,
	onCreate,
	isRouteModal = false,
}) => {
	const navigate = useNavigate();
	const createDefendant = useCreateDefendant();

	const handleClose = () => {
		if (isRouteModal) {
			// Navigate back to defendants list for route-based modals
			navigate("/defendants");
		} else {
			// Just close the modal for inline modals
			onOpenChange(false);
		}
	};

	const handleSubmit = async (data: CreateDefendantFormData) => {
		try {
			// Transform form data for API
			const apiData = {
				first_name: data.first_name || null,
				last_name: data.last_name,
			};

			const newDefendant = await createDefendant.mutateAsync(apiData);

			// Call onCreate callback if provided (for inline modals)
			if (onCreate) {
				onCreate(newDefendant);
			}

			// Close the modal
			handleClose();
		} catch (error) {
			// Error is handled by the mutation (toast shown)
			console.error("Failed to create defendant:", error);
			// Don't close modal on error so user can retry
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose} modal={true}>
			<DialogContent
				className="sm:max-w-[500px]"
				onInteractOutside={(e) => e.preventDefault()}
			>
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
