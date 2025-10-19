import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { CreateStationForm } from "./CreateStationForm";

interface CreateStationModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function CreateStationModal({
	isOpen,
	onClose,
}: CreateStationModalProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Create New Police Station</DialogTitle>
					<DialogDescription>
						Add a new police station to the system. All fields
						marked with * are required.
					</DialogDescription>
				</DialogHeader>
				<CreateStationForm onSuccess={onClose} onCancel={onClose} />
			</DialogContent>
		</Dialog>
	);
}
