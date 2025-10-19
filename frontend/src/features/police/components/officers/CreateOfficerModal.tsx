import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { useCreatePoliceOfficer } from "../../hooks/usePoliceOfficers";
import { CreateOfficerForm } from "./CreateOfficerForm";

interface CreateOfficerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const CreateOfficerModal = ({
	open,
	onOpenChange,
}: CreateOfficerModalProps) => {
	const createOfficerMutation = useCreatePoliceOfficer();

	const handleSubmit = async (data: any) => {
		try {
			await createOfficerMutation.mutateAsync(data);
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
