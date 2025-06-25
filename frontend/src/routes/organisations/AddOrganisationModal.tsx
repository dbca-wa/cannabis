import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AddOrganisationFormData } from "@/types";
import { useOrganisations } from "@/hooks/tanstack/useOrganisations";
import AddOrganisationForm from "@/components/core/organisations/forms/AddOrganisationForm";

export const AddOrganisationModal = () => {
	const navigate = useNavigate();
	const { isCreating, createStation } = useOrganisations();

	const handleClose = () => {
		navigate("/organisations");
	};

	const handleSubmit = async (data: AddOrganisationFormData) => {
		try {
			await createStation(data);
			toast.success("Organisation created successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to create organisation");
			console.error("Create error:", error);
		}
	};

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side={"bottom"}
				title="Add Organisation"
				description="Create a new police station organisation"
			>
				<AddOrganisationForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isCreating}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
