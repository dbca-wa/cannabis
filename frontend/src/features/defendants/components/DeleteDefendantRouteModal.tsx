import { useNavigate, useParams } from "react-router";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { ReplaceAndDeleteDialog } from "@/shared/components/ReplaceAndDeleteDialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
	useDefendantById,
	useDefendantUsage,
	useDeleteDefendant,
} from "../hooks/useDefendants";
import { DefendantSearchCombobox } from "./DefendantSearchCombobox";

export const DeleteDefendantRouteModal = () => {
	const navigate = useNavigate();
	const { defendantId } = useParams<{ defendantId: string }>();
	const id = defendantId ? parseInt(defendantId, 10) : null;
	const { isAdmin } = useAuth();
	const deleteDefendant = useDeleteDefendant();
	const { data: defendant, isLoading, error } = useDefendantById(id);
	const usage = useDefendantUsage(id);

	const handleClose = () => {
		navigate("/defendants");
	};

	const handleDelete = async (replacementId: number | null) => {
		if (!id) return;
		try {
			await deleteDefendant.mutateAsync({ id, replacementId });
			handleClose();
		} catch {
			// The mutation shows the error.
		}
	};

	if (isLoading) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Loading..." description="">
					<PageLoading text="Loading defendant details..." />
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	if (error || !defendant) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Error" description="">
					<ErrorAlert
						error={error || "Defendant not found"}
						title="Failed to load defendant"
						onDismiss={handleClose}
					/>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	return (
		<ReplaceAndDeleteDialog
			title="Delete defendant"
			name={defendant.full_name}
			noun="defendant"
			recordId={defendant.id}
			usage={usage.data}
			isLoadingUsage={usage.isLoading}
			usageError={usage.error}
			isAdmin={isAdmin}
			isDeleting={deleteDefendant.isPending}
			renderPicker={(picker) => (
				<DefendantSearchCombobox
					id={picker.id}
					value={picker.value}
					onValueChange={picker.onValueChange}
					error={picker.error}
					exclude={[defendant.id]}
					placeholder="Search for a defendant..."
				/>
			)}
			onConfirm={handleDelete}
			onClose={handleClose}
		/>
	);
};
