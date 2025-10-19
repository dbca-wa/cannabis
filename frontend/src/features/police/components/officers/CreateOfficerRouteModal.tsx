import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate } from "react-router";
import { CreateOfficerForm } from "./CreateOfficerForm";
import { useCreatePoliceOfficer } from "../../hooks/usePoliceOfficers";

export const CreateOfficerRouteModal = () => {
	const navigate = useNavigate();
	const createOfficerMutation = useCreatePoliceOfficer();

	const handleClose = () => {
		navigate("/police/officers");
	};

	const handleSubmit = async (data: unknown) => {
		try {
			// Transform form data to API format
			const transformedData = {
				badge_number: (data as any).badge_number || undefined,
				first_name: (data as any).first_name || undefined,
				last_name: (data as any).last_name,
				rank: (data as any).rank,
				station: (data as any).station
					? parseInt((data as unknown).station)
					: undefined,
			};
			await createOfficerMutation.mutateAsync(transformedData);
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Create officer error:", error);
		}
	};

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Add Police Officer"
				description="Create a new police officer record"
			>
				<CreateOfficerForm
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isLoading={createOfficerMutation.isPending}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
