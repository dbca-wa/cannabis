import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { EditStationForm } from "./EditStationForm";
import type { PoliceStation } from "@/shared/types/backend-api.types";

interface EditStationModalProps {
	isOpen: boolean;
	onClose: () => void;
	station: PoliceStation;
}

export function EditStationModal({
	isOpen,
	onClose,
	station,
}: EditStationModalProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Police Station</DialogTitle>
					<DialogDescription>
						Update the information for {station.name}. All fields
						marked with * are required.
					</DialogDescription>
				</DialogHeader>
				<EditStationForm
					station={station}
					onSuccess={onClose}
					onCancel={onClose}
				/>
			</DialogContent>
		</Dialog>
	);
}
