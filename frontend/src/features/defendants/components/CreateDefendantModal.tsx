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
import { nameFromSearch } from "@/shared/utils/name-search.utils";

interface CreateDefendantModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional callback when defendant is successfully created */
	onCreate?: (defendant: DefendantTiny) => void;
	/** If true, will navigate to /defendants on close (for route-based modals) */
	isRouteModal?: boolean;
	/** What was typed into the search, used to fill in the name. */
	initialSearch?: string;
}

export const CreateDefendantModal: React.FC<CreateDefendantModalProps> = ({
	open,
	onOpenChange,
	onCreate,
	isRouteModal = false,
	initialSearch = "",
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
				given_names: data.given_names || null,
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
						Add a new defendant to the system. Surname is required and will be
						stored in uppercase.
					</DialogDescription>
				</DialogHeader>
				{/* Keyed on the search so each opening starts from what was typed. */}
				<CreateDefendantForm
					key={open ? initialSearch : "closed"}
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isSubmitting={createDefendant.isPending}
					initialName={nameFromSearch(initialSearch)}
				/>
			</DialogContent>
		</Dialog>
	);
};
