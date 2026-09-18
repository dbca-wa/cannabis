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
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { getPhaseBadgeClass } from "../../utils/cases.utils";
import { formatDate } from "@/shared/utils/date.utils";
import { useState } from "react";

/** Typed exactly (case-insensitively) before the delete button unlocks. */
const REQUIRED_CONFIRMATION = "delete";

export const DeleteCaseRouteModal = () => {
	const navigate = useNavigate();
	const { id } = useParams();
	const { deleteCase, isDeleting } = useCases();
	const [confirmationText, setConfirmationText] = useState("");

	const confirmationMatches =
		confirmationText.trim().toLowerCase() === REQUIRED_CONFIRMATION;

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
		if (!id || !confirmationMatches) return;

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

	// A case can be deleted at any point up until one of its certificates joins a
	// batch. After that the batch's tallies and packaged documents depend on those
	// certificates, so the batch must be removed first.
	const batchedCertificateNumbers = caseObj.forms
		.map((form) => form.certificate)
		.filter((cert) => cert && cert.batch_id !== null)
		.map((cert) => cert!.certificate_number)
		.filter(Boolean);

	const canDelete = batchedCertificateNumbers.length === 0;
	const warningMessage = canDelete
		? null
		: `This case cannot be deleted because its certificates belong to a batch (${batchedCertificateNumbers.join(", ")}). Delete the batch first if the case really must be removed.`;

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

					{/* What goes and what stays */}
					{canDelete && (
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-800 dark:bg-red-950/20">
								<p className="mb-1.5 text-sm font-medium text-red-900 dark:text-red-100">
									Will be permanently removed
								</p>
								<ul className="list-disc space-y-0.5 pl-4 text-xs text-red-800 dark:text-red-200">
									<li>This case and its details</li>
									<li>All of its Priority 3 forms</li>
									<li>All drug bags and their assessments</li>
									<li>Any generated certificates</li>
								</ul>
							</div>
							<div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
								<p className="mb-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
									Will be kept
								</p>
								<ul className="list-disc space-y-0.5 pl-4 text-xs text-gray-700 dark:text-gray-300">
									<li>Police officers</li>
									<li>Police stations</li>
									<li>Defendants</li>
									<li>Every other case</li>
								</ul>
							</div>
						</div>
					)}

					{/* Typed confirmation */}
					{canDelete && (
						<div className="space-y-2">
							<Label htmlFor="delete-confirmation">
								Type <span className="font-mono font-semibold">delete</span> to
								confirm
							</Label>
							<Input
								id="delete-confirmation"
								value={confirmationText}
								onChange={(e) => setConfirmationText(e.target.value)}
								placeholder="delete"
								autoComplete="off"
								disabled={isDeleting}
								aria-describedby="delete-confirmation-hint"
							/>
							<p
								id="delete-confirmation-hint"
								className="text-xs text-muted-foreground"
							>
								This cannot be undone.
							</p>
						</div>
					)}

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
								disabled={isDeleting || !confirmationMatches}
								title={
									confirmationMatches
										? undefined
										: 'Type "delete" to enable this button'
								}
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
