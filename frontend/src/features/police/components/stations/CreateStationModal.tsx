import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { CreateStationForm } from "./CreateStationForm";
import type { PoliceStation } from "@/shared/types/backend-api.types";

interface CreateStationModalProps {
	isOpen: boolean;
	onClose: () => void;
	/** Optional callback when station is successfully created */
	onCreate?: (station: PoliceStation) => void;
}

export function CreateStationModal({
	isOpen,
	onClose,
	onCreate,
}: CreateStationModalProps) {
	const handleSuccess = (station?: PoliceStation) => {
		// Call onCreate callback if provided and station data is available
		if (onCreate && station) {
			onCreate(station);
		}
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose} modal={true}>
			<DialogContent
				className="sm:max-w-[500px]"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>Create New Police Station</DialogTitle>
					<DialogDescription>
						Add a new police station to the system. All fields
						marked with * are required.
					</DialogDescription>
				</DialogHeader>
				<CreateStationForm
					onSuccess={handleSuccess}
					onCancel={onClose}
				/>
			</DialogContent>
		</Dialog>
	);
}
