import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { useUpdatePoliceOfficer } from "../../hooks/usePoliceOfficers";
import { EditOfficerForm } from "./EditOfficerForm";

import type {
	PoliceOfficerTiny,
	PoliceOfficerUpdateRequest,
} from "@/shared/types/backend-api.types";

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

	const handleSubmit = async (data: unknown) => {
		await updateOfficerMutation.mutateAsync({
			id: officer.id,
			data: data as PoliceOfficerUpdateRequest,
		});
		onOpenChange(false);
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
						Update the officer's information. Last name is required, given names
						is optional.
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
