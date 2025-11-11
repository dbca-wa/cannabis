import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { useCreatePoliceOfficer } from "../../hooks/usePoliceOfficers";
import { CreateOfficerForm } from "./CreateOfficerForm";
import type { PoliceOfficerTiny } from "@/shared/types/backend-api.types";

interface CreateOfficerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional callback when officer is successfully created */
	onCreate?: (officer: PoliceOfficerTiny) => void;
}

export const CreateOfficerModal = ({
	open,
	onOpenChange,
	onCreate,
}: CreateOfficerModalProps) => {
	const createOfficerMutation = useCreatePoliceOfficer();

	const handleSubmit = async (data: any) => {
		try {
			const newOfficer = await createOfficerMutation.mutateAsync(data);

			// Call onCreate callback if provided
			if (onCreate) {
				const tinyOfficer: PoliceOfficerTiny = {
					id: newOfficer.id,
					badge_number: newOfficer.badge_number,
					first_name: newOfficer.first_name,
					last_name: newOfficer.last_name,
					full_name: newOfficer.full_name,
					rank: newOfficer.rank,
					rank_display: newOfficer.rank_display,
					station: newOfficer.station,
					station_name: newOfficer.station_details?.name || null,
					email: "",
					is_sworn: newOfficer.is_sworn,
				};
				onCreate(tinyOfficer);
			}

			onOpenChange(false);
		} catch (error) {
			// Error handling is done in the mutation
			throw error;
		}
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange} modal={true}>
			<DialogContent
				className="sm:max-w-[500px]"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>Create New Officer</DialogTitle>
					<DialogDescription>
						Add a new police officer to the system. Last name is
						required, first name is optional.
					</DialogDescription>
				</DialogHeader>

				<CreateOfficerForm
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					isLoading={createOfficerMutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
};
