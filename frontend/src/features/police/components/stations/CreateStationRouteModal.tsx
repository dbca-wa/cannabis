import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate } from "react-router";
import { CreateStationForm } from "./CreateStationForm";

export const CreateStationRouteModal = () => {
	const navigate = useNavigate();

	const handleClose = () => {
		navigate("/stations");
	};

	// The form handles the case internally

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Add Police Station"
				description="Create a new police station record"
			>
				<CreateStationForm onSuccess={handleClose} onCancel={handleClose} />
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
