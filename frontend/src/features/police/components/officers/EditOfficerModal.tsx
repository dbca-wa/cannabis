import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { useUpdatePoliceOfficer } from "../../hooks/usePoliceOfficers";
import { EditOfficerForm } from "./EditOfficerForm";

import type { PoliceOfficerTiny } from "@/shared/types/backend-api.types";

interface EditOfficerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	officer: PoliceOfficerTiny;
}

export const EditOfficerModal = ({
	open,
	onOpenChange,
	officer,
}: EditOfficerModalProps) => {
	const updateOfficerMutation = useUpdatePoliceOfficer();

	const handleSubmit = async (data: any) => {
		try {
			await updateOfficerMutation.mutateAsync({
				id: officer.id,
				data,
			});
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Officer</DialogTitle>
					<DialogDescription>
						Update the officer's information. Last name is required,
						first name is optional.
					</DialogDescription>
				</DialogHeader>

				<EditOfficerForm
					officer={officer}
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					isLoading={updateOfficerMutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
};
