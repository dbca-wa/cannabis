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
				onCreate(newOfficer);
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
