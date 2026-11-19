import { useState } from "react";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import {
	useDeletePoliceOfficer,
	useOfficerUsage,
	usePoliceOfficer,
} from "../../hooks/usePoliceOfficers";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { ReplaceAndDeleteDialog } from "@/shared/components/ReplaceAndDeleteDialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { OfficerSearchComboBox } from "./OfficerSearchComboBox";

export const DeleteOfficerRouteModal = () => {
	const navigate = useNavigate();
	const { officerId } = useParams();
	const id = officerId ? parseInt(officerId, 10) : 0;
	// Once deletion starts, stop refetching the record being deleted.
	const [deleting, setDeleting] = useState(false);
	const { isAdmin } = useAuth();
	const deleteOfficerMutation = useDeletePoliceOfficer();
	const { data: officer, isLoading, error } = usePoliceOfficer(id, !deleting);
	const usage = useOfficerUsage(id || null, !deleting);

	const handleClose = () => {
		navigate("/officers");
	};

	const handleDelete = async (replacementId: number | null) => {
		if (!id) return;
		setDeleting(true);
		try {
			await deleteOfficerMutation.mutateAsync({ id, replacementId });
			handleClose();
		} catch {
			setDeleting(false);
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
					<PageLoading text="Loading officer details..." />
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	if (error || !officer) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Error" description="">
					<ErrorAlert
						error={error || "Officer not found"}
						title="Failed to load officer"
						onDismiss={handleClose}
					/>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	return (
		<ReplaceAndDeleteDialog
			title="Delete police officer"
			name={officer.full_name}
			noun="officer"
			recordId={officer.id}
			usage={usage.data}
			isLoadingUsage={usage.isLoading}
			usageError={usage.error}
			isAdmin={isAdmin}
			isDeleting={deleteOfficerMutation.isPending}
			renderPicker={(picker) => (
				<OfficerSearchComboBox
					id={picker.id}
					value={picker.value}
					onValueChange={picker.onValueChange}
					error={picker.error}
					placeholder="Search for an officer..."
				/>
			)}
			onConfirm={handleDelete}
			onClose={handleClose}
		/>
	);
};
