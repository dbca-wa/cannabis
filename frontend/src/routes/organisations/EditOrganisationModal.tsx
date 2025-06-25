import EditOrganisationForm from "@/components/core/organisations/forms/EditOrganisationForm";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useOrganisations } from "@/hooks/tanstack/useOrganisations";
import { EditOrganisationFormData } from "@/types";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export const EditOrganisationModal = () => {
	const navigate = useNavigate();
	const { organisationId } = useParams();
	const { updateStation, isUpdating, refreshStation } = useOrganisations();

	const handleClose = () => {
		navigate("/organisations");
	};

	const handleSubmit = async (transformedData: EditOrganisationFormData) => {
		if (!organisationId) return;

		console.log("Transformed data from form:", transformedData);

		try {
			await updateStation({
				id: organisationId,
				data: transformedData,
			});

			// Force refresh the station data to ensure we have the latest
			await refreshStation(organisationId);

			toast.success("Organisation updated successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to update organisation");
			console.error("Update error:", error);
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
				title="Edit Organisation"
				description="Update organisation information and settings"
			>
				<EditOrganisationForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isUpdating}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
