import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { useCases, useCaseById } from "../../hooks/useCases";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle, FileText, Calendar, User, Loader2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { getPhaseBadgeClass } from "../../utils/cases.utils";
import { formatDate } from "@/shared/utils/date.utils";

export const DeleteCaseRouteModal = () => {
	const navigate = useNavigate();
	const { id } = useParams();
	const { deleteCase, isDeleting } = useCases();

	// Fetch case data
	const {
		data: caseObj,
		isLoading,
		error,
	} = useCaseById(id ? parseInt(id) : null);

	const handleClose = () => {
		navigate("/cases");
	};

	const handleDelete = async () => {
		if (!id) return;

		try {
			await new Promise<void>((resolve, reject) => {
				deleteCase(parseInt(id), {
					onSuccess: () => {
						resolve();
						handleClose();
					},
					onError: (error) => {
						reject(error);
					},
				});
			});
		} catch (error) {
			console.error("Delete case error:", error);
		}
	};

	if (isLoading) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Loading..." description="">
					<PageLoading text="Loading case details..." />
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	if (error || !caseObj) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Error" description="">
					<ErrorAlert
						error={error || "Case not found"}
						title="Failed to load case"
						onDismiss={handleClose}
					/>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	// A case can be deleted while it is still being processed. Once it has been
	// batched or completed it forms part of finance records and must be retained.
	const canDelete = caseObj.derived_status !== "complete";
	const warningMessage = !canDelete
		? "This case cannot be deleted because it has been completed. Cases become part of finance records once batched."
		: null;

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Delete Case"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					{/* Warning Banner */}
					<div
						className={`flex items-center gap-3 p-4 rounded-lg border ${
							canDelete
								? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
								: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
						}`}
					>
						<AlertTriangle
							className={`h-5 w-5 ${
								canDelete
									? "text-red-600 dark:text-red-400"
									: "text-orange-600 dark:text-orange-400"
							}`}
						/>
						<div className="flex-1">
							<p
								className={`font-medium ${
									canDelete
										? "text-red-900 dark:text-red-100"
										: "text-orange-900 dark:text-orange-100"
								}`}
							>
								{canDelete
									? "Are you sure you want to delete this case?"
									: "Cannot Delete Case"}
							</p>
							{warningMessage && (
								<p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
									{warningMessage}
								</p>
							)}
						</div>
					</div>

					{/* Case Details */}
					<div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-gray-100">
								Case Number:
							</span>
							<span className="text-gray-700 dark:text-gray-300">
								{caseObj.case_number}
							</span>
						</div>

						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-gray-100">
								Received:
							</span>
							<span className="text-gray-700 dark:text-gray-300">
								{formatDate(caseObj.received)}
							</span>
						</div>

						<div className="flex items-center gap-2">
							<User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-gray-100">
								Status:
							</span>
							<Badge className={getPhaseBadgeClass(caseObj.derived_status)}>
								{caseObj.derived_status_display}
							</Badge>
						</div>

						{caseObj.bags_count > 0 && (
							<div className="flex items-center gap-2">
								<span className="font-medium text-gray-900 dark:text-gray-100">
									Drug Bags:
								</span>
								<span className="text-gray-700 dark:text-gray-300">
									{caseObj.bags_count} bag(s)
								</span>
							</div>
						)}
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3 justify-end">
						<Button
							variant="outline"
							onClick={handleClose}
							disabled={isDeleting}
						>
							{canDelete ? "Cancel" : "Close"}
						</Button>
						{canDelete && (
							<Button
								variant="destructive"
								onClick={handleDelete}
								disabled={isDeleting}
							>
								{isDeleting && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								{isDeleting ? "Deleting..." : "Delete Case"}
							</Button>
						)}
					</div>
				</div>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
