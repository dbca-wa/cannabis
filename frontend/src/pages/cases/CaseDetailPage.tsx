import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { observer } from "mobx-react-lite";
import { AlertCircle, ArrowLeft } from "lucide-react";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { PhaseProgressIndicator } from "@/features/cases/components/PhaseProgressIndicator";
import { PhaseActionsBar } from "@/features/cases/components/PhaseActionsBar";
import { PhaseContent } from "@/features/cases/components/PhaseContent";
import { useCaseById } from "@/features/cases/hooks/useCases";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { type CasePhase } from "@/shared/types/backend-api.types";
import {
	canEditPhase,
	getCompletedPhases,
	isPhaseClickable,
} from "@/features/cases/utils";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/**
 * CaseDetailPage Component
 *
 * Main page component for viewing and managing individual cases through their workflow lifecycle.
 * Features a beautiful animated progress indicator, phase-specific content, and role-based actions.
 *
 * Features:
 * - Phase progress indicator with 7 workflow phases
 * - Phase-specific content display (creation, assessment, certificate, sign-off, invoicing, email, complete)
 * - Role-based phase advancement and send-back functionality
 * - URL parameter support for viewing specific phases
 * - Loading states and error handling
 * - Permission-based access control
 */
export const CaseDetailPage: React.FC = observer(() => {
	const { submissionId } = useParams<{ submissionId: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { user: currentUser } = useAuth();

	// Parse case ID
	const parsedCaseId = submissionId ? parseInt(submissionId, 10) : null;

	// Fetch case data
	const {
		data: caseObj,
		isLoading,
		isError,
		error,
		refetch,
	} = useCaseById(parsedCaseId);

	useDocumentTitle(caseObj ? `Case ${caseObj.case_number}` : "Case");

	// Phase viewing state (defaults to current phase or URL parameter)
	const [viewingPhase, setViewingPhase] = useState<CasePhase | null>(null);

	// Action loading states
	const [isAdvancing, setIsAdvancing] = useState(false);
	const [isSendingBack, setIsSendingBack] = useState(false);

	// Initialise viewing phase from URL parameter or case's current phase
	useEffect(() => {
		if (caseObj) {
			const phaseParam = searchParams.get("phase") as CasePhase | null;
			if (phaseParam && isValidPhase(phaseParam)) {
				setViewingPhase(phaseParam);
			} else {
				setViewingPhase(caseObj.phase);
			}
		}
	}, [caseObj, searchParams]);

	// Validate phase string
	const isValidPhase = (phase: string): phase is CasePhase => {
		const validPhases: CasePhase[] = [
			"case_creation",
			"assessment",
			"unsigned_generation",
			"botanist_signoff",
			"invoicing",
			"send_emails",
			"complete",
		];
		return validPhases.includes(phase as CasePhase);
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
	const handlePhaseClick = (phase: CasePhase) => {
		if (!caseObj) return;

		// Check if phase is clickable using utility function
		const canView = isPhaseClickable(phase, caseObj.phase);

		if (canView) {
			setViewingPhase(phase);
			// Update URL parameter
			setSearchParams({ phase });
			logger.info("Phase navigation", {
				submissionId: parsedCaseId,
				fromPhase: viewingPhase,
				toPhase: phase,
			});
		}
	};

	// Handle phase advancement
	const handleAdvance = async () => {
		if (!caseObj) return;

		setIsAdvancing(true);
		try {
			// TODO: Call API to advance phase
			// For now, just show a toast
			toast.info("Phase advancement will be implemented with backend API");
			logger.info("Advancing phase", {
				submissionId: caseObj.id,
				currentPhase: caseObj.phase,
			});

			// Refetch case data after advancement
			await refetch();
		} catch (error) {
			logger.error("Failed to advance phase", { error });
			toast.error("Failed to advance phase. Please try again.");
		} finally {
			setIsAdvancing(false);
		}
	};

	// Handle send-back
	const handleSendBack = async (targetPhase: CasePhase, reason: string) => {
		if (!caseObj) return;

		setIsSendingBack(true);
		try {
			// TODO: Call API to send back
			// For now, just show a toast
			toast.info(
				`Send-back to ${targetPhase} will be implemented with backend API`
			);
			logger.info("Sending back case", {
				submissionId: caseObj.id,
				currentPhase: caseObj.phase,
				targetPhase,
				reason,
			});

			// Refetch case data after send-back
			await refetch();
		} catch (error) {
			logger.error("Failed to send back case", { error });
			toast.error("Failed to send back case. Please try again.");
		} finally {
			setIsSendingBack(false);
		}
	};

	// Handle case update
	const handleUpdate = async (data: Partial<typeof caseObj>) => {
		if (!caseObj) return;

		try {
			// TODO: Call API to update case
			toast.info("Case update will be implemented with backend API");
			logger.info("Updating case", {
				submissionId: caseObj.id,
				updates: data,
			});

			// Refetch case data after update
			await refetch();
		} catch (error) {
			logger.error("Failed to update case", { error });
			toast.error("Failed to update case. Please try again.");
		}
	};

	// Determine if user can edit current phase using utility function
	const canEdit = (): boolean => {
		if (!caseObj || !viewingPhase) return false;

		const userRole = getUserRole();
		const isCurrentPhase = viewingPhase === caseObj.phase;
		return canEditPhase(viewingPhase, isCurrentPhase, userRole, isAdmin);
	};

	// Loading state
	if (isLoading) {
		return (
			<ContentLayout maxWidth="full" title="Case">
				<div className="space-y-6">
					{/* Back button skeleton */}
					<Skeleton className="h-9 w-32 rounded-md" />

					{/* Phase progress indicator skeleton */}
					<div className="flex items-center justify-between gap-2 p-4 rounded-xl border">
						{Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className="flex items-center gap-2">
								<Skeleton className="h-8 w-8 rounded-full" />
								{i < 7 && <Skeleton className="h-0.5 w-8" />}
							</div>
						))}
					</div>

					{/* Phase actions bar skeleton */}
					<div className="flex items-center justify-between p-4 rounded-xl border">
						<Skeleton className="h-5 w-40" />
						<div className="flex gap-2">
							<Skeleton className="h-9 w-24 rounded-md" />
							<Skeleton className="h-9 w-28 rounded-md" />
						</div>
					</div>

					{/* Phase content skeleton */}
					<div className="bg-white dark:bg-card rounded-xl shadow-lg p-6 md:p-8 space-y-6">
						<Skeleton className="h-7 w-48" />
						<div className="space-y-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-4 w-5/6" />
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Skeleton className="h-24 rounded-lg" />
							<Skeleton className="h-24 rounded-lg" />
							<Skeleton className="h-24 rounded-lg" />
							<Skeleton className="h-24 rounded-lg" />
						</div>
					</div>
				</div>
			</ContentLayout>
		);
	}

	// Error state - Not found
	if (isError || !caseObj) {
		return (
			<ContentLayout maxWidth="full" title="Case">
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="text-center max-w-md">
						<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
						<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
							Case Not Found
						</h2>
						<p className="text-gray-600 dark:text-gray-400 mb-6">
							{error
								? `Error: ${error.message}`
								: "The case you're looking for doesn't exist or you don't have permission to view it."}
						</p>
						<div className="flex items-center justify-center gap-3">
							<Button variant="outline" onClick={() => refetch()}>
								Try Again
							</Button>
							<Button
								onClick={() => navigate("/cases")}
								className="bg-blue-600 hover:bg-blue-700"
							>
								<ArrowLeft className="w-4 h-4 mr-2" />
								Back to Cases
							</Button>
						</div>
					</div>
				</div>
			</ContentLayout>
		);
	}

	// Permission denied state
	if (!viewingPhase) {
		return (
			<ContentLayout maxWidth="full" title={`Case ${caseObj.case_number}`}>
				<div className="flex items-center justify-center min-h-[400px]">
					<div className="text-center max-w-md">
						<AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
						<h2 className="text-2xl font-bold text-gray-900 mb-2">
							Loading Phase Data
						</h2>
						<p className="text-gray-600 mb-6">
							Please wait while we load the case phase information...
						</p>
					</div>
				</div>
			</ContentLayout>
		);
	}

	const isCurrentPhase = viewingPhase === caseObj.phase;
	const completedPhases = getCompletedPhases(caseObj.phase);
	const userRole = getUserRole();

	return (
		<ContentLayout
			maxWidth="full"
			title={`Case ${caseObj.case_number}`}
			hideBreadcrumb
		>
			<div className="space-y-6">
				{/* Back Button */}
				<div>
					<Button
						variant="outline"
						onClick={() => navigate("/cases")}
						className="mb-4"
					>
						<ArrowLeft className="w-4 h-4 mr-2" />
						Back to Cases
					</Button>
				</div>

				{/* Phase Progress Indicator */}
				<PhaseProgressIndicator
					currentPhase={caseObj.phase}
					completedPhases={completedPhases}
					viewingPhase={viewingPhase}
					onPhaseClick={handlePhaseClick}
				/>

				{/* Phase Actions Bar */}
				<PhaseActionsBar
					currentPhase={caseObj.phase}
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
						caseObj={caseObj}
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

CaseDetailPage.displayName = "CaseDetailPage";
