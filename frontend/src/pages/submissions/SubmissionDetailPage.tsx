import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { observer } from "mobx-react-lite";
import { AlertCircle, ArrowLeft } from "lucide-react";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import { Button } from "@/shared/components/ui/button";
import { PhaseProgressIndicator } from "@/features/submissions/components/PhaseProgressIndicator";
import { PhaseActionsBar } from "@/features/submissions/components/PhaseActionsBar";
import { PhaseContent } from "@/features/submissions/components/PhaseContent";
import { useSubmissionById } from "@/features/submissions/hooks/useSubmissions";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { type SubmissionPhase } from "@/shared/types/backend-api.types";
import {
	canEditPhase,
	getCompletedPhases,
	isPhaseClickable,
} from "@/features/submissions/utils";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import { Head } from "@/shared/components/layout/Head";

/**
 * SubmissionDetailPage Component
 *
 * Main page component for viewing and managing individual submissions through their workflow lifecycle.
 * Features a beautiful animated progress indicator, phase-specific content, and role-based actions.
 *
 * Features:
 * - Phase progress indicator with 6 workflow phases
 * - Phase-specific content display (data entry, finance, botanist, documents, emails, complete)
 * - Role-based phase advancement and send-back functionality
 * - URL parameter support for viewing specific phases
 * - Loading states and error handling
 * - Permission-based access control
 *
 * Requirements: 2.1-2.6, 3.1-3.8, 4.1-4.7, 14.1-14.6
 */
export const SubmissionDetailPage: React.FC = observer(() => {
	const { submissionId } = useParams<{ submissionId: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { user: currentUser } = useAuth();

	// Parse submission ID
	const parsedSubmissionId = submissionId ? parseInt(submissionId, 10) : null;

	// Fetch submission data
	const {
		data: submission,
		isLoading,
		isError,
		error,
		refetch,
	} = useSubmissionById(parsedSubmissionId);

	// Phase viewing state (defaults to current phase or URL parameter)
	const [viewingPhase, setViewingPhase] = useState<SubmissionPhase | null>(
		null
	);

	// Action loading states
	const [isAdvancing, setIsAdvancing] = useState(false);
	const [isSendingBack, setIsSendingBack] = useState(false);

	// Initialize viewing phase from URL parameter or submission's current phase
	useEffect(() => {
		if (submission) {
			const phaseParam = searchParams.get(
				"phase"
			) as SubmissionPhase | null;
			if (phaseParam && isValidPhase(phaseParam)) {
				setViewingPhase(phaseParam);
			} else {
				setViewingPhase(submission.phase);
			}
		}
	}, [submission, searchParams]);

	// Validate phase string
	const isValidPhase = (phase: string): phase is SubmissionPhase => {
		const validPhases: SubmissionPhase[] = [
			"data_entry",
			"finance_approval",
			"botanist_review",
			"documents",
			"send_emails",
			"complete",
		];
		return validPhases.includes(phase as SubmissionPhase);
	};

	// Get user role
	const getUserRole = (): "botanist" | "finance" | "none" => {
		if (!currentUser) return "none";
		if (currentUser.role === "botanist") return "botanist";
		if (currentUser.role === "finance") return "finance";
		return "none";
	};

	// Check if user is admin
	const isAdmin = currentUser?.is_superuser || false;

	// Handle phase click (navigation between phases)
	const handlePhaseClick = (phase: SubmissionPhase) => {
		if (!submission) return;

		// Check if phase is clickable using utility function
		const canView = isPhaseClickable(phase, submission.phase);

		if (canView) {
			setViewingPhase(phase);
			// Update URL parameter
			setSearchParams({ phase });
			logger.info("Phase navigation", {
				submissionId: parsedSubmissionId,
				fromPhase: viewingPhase,
				toPhase: phase,
			});
		}
	};

	// Handle phase advancement
	const handleAdvance = async () => {
		if (!submission) return;

		setIsAdvancing(true);
		try {
			// TODO: Call API to advance phase
			// For now, just show a toast
			toast.info(
				"Phase advancement will be implemented with backend API"
			);
			logger.info("Advancing phase", {
				submissionId: submission.id,
				currentPhase: submission.phase,
			});

			// Refetch submission data after advancement
			await refetch();
		} catch (error) {
			logger.error("Failed to advance phase", { error });
			toast.error("Failed to advance phase. Please try again.");
		} finally {
			setIsAdvancing(false);
		}
	};

	// Handle send-back
	const handleSendBack = async (
		targetPhase: SubmissionPhase,
		reason: string
	) => {
		if (!submission) return;

		setIsSendingBack(true);
		try {
			// TODO: Call API to send back
			// For now, just show a toast
			toast.info(
				`Send-back to ${targetPhase} will be implemented with backend API`
			);
			logger.info("Sending back submission", {
				submissionId: submission.id,
				currentPhase: submission.phase,
				targetPhase,
				reason,
			});

			// Refetch submission data after send-back
			await refetch();
		} catch (error) {
			logger.error("Failed to send back submission", { error });
			toast.error("Failed to send back submission. Please try again.");
		} finally {
			setIsSendingBack(false);
		}
	};

	// Handle submission update
	const handleUpdate = async (data: Partial<typeof submission>) => {
		if (!submission) return;

		try {
			// TODO: Call API to update submission
			toast.info(
				"Submission update will be implemented with backend API"
			);
			logger.info("Updating submission", {
				submissionId: submission.id,
				updates: data,
			});

			// Refetch submission data after update
			await refetch();
		} catch (error) {
			logger.error("Failed to update submission", { error });
			toast.error("Failed to update submission. Please try again.");
		}
	};

	// Determine if user can edit current phase using utility function
	const canEdit = (): boolean => {
		if (!submission || !viewingPhase) return false;

		const userRole = getUserRole();
		const isCurrentPhase = viewingPhase === submission.phase;
		return canEditPhase(viewingPhase, isCurrentPhase, userRole, isAdmin);
	};

	// Breadcrumbs
	const breadcrumbs = [
		{ label: "Submissions", href: "/submissions" },
		{
			label: submission
				? `${submission.case_number}`
				: `Submission #${submissionId}`,
			current: true,
		},
	];

	// Loading state
	if (isLoading) {
		return (
			<ContentLayout breadcrumbs={breadcrumbs} maxWidth="full">
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="text-center">
						<div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
						<p className="mt-4 text-gray-600">
							Loading submission...
						</p>
					</div>
				</div>
			</ContentLayout>
		);
	}

	// Error state - Not found
	if (isError || !submission) {
		return (
			<ContentLayout breadcrumbs={breadcrumbs} maxWidth="full">
				<Head title="Submission Details" />
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="text-center max-w-md">
						<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							Submission Not Found
						</h2>
						<p className="text-gray-600 mb-6">
							{error
								? `Error: ${error.message}`
								: "The submission you're looking for doesn't exist or you don't have permission to view it."}
						</p>
						<Button
							onClick={() => navigate("/submissions")}
							className="bg-blue-600 hover:bg-blue-700"
						>
							<ArrowLeft className="w-4 h-4 mr-2" />
							Back to Submissions
						</Button>
					</div>
				</div>
			</ContentLayout>
		);
	}

	// Permission denied state
	if (!viewingPhase) {
		return (
			<ContentLayout breadcrumbs={breadcrumbs} maxWidth="full">
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="text-center max-w-md">
						<AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							Loading Phase Data
						</h2>
						<p className="text-gray-600 mb-6">
							Please wait while we load the submission phase
							information...
						</p>
					</div>
				</div>
			</ContentLayout>
		);
	}

	const isCurrentPhase = viewingPhase === submission.phase;
	const completedPhases = getCompletedPhases(submission.phase);
	const userRole = getUserRole();

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="full">
			<div className="space-y-6">
				{/* Back Button */}
				<div>
					<Button
						variant="outline"
						onClick={() => navigate("/submissions")}
						className="mb-4"
					>
						<ArrowLeft className="w-4 h-4 mr-2" />
						Back to Submissions
					</Button>
				</div>

				{/* Phase Progress Indicator */}
				<PhaseProgressIndicator
					currentPhase={submission.phase}
					completedPhases={completedPhases}
					viewingPhase={viewingPhase}
					onPhaseClick={handlePhaseClick}
				/>

				{/* Phase Actions Bar */}
				<PhaseActionsBar
					currentPhase={submission.phase}
					viewingPhase={viewingPhase}
					isCurrentPhase={isCurrentPhase}
					userRole={userRole}
					isAdmin={isAdmin}
					isAdvancing={isAdvancing}
					isSendingBack={isSendingBack}
					onAdvance={handleAdvance}
					onSendBack={handleSendBack}
				/>

				{/* Phase Content */}
				<div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
					<PhaseContent
						submission={submission}
						phase={viewingPhase}
						isCurrentPhase={isCurrentPhase}
						canEdit={canEdit()}
						onUpdate={handleUpdate}
					/>
				</div>
			</div>
		</ContentLayout>
	);
});

SubmissionDetailPage.displayName = "SubmissionDetailPage";
