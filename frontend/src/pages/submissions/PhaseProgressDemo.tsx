import React, { useState } from "react";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import {
	PhaseProgressIndicator,
	PhaseActionsBar,
	PhaseContent,
} from "@/features/submissions/components";
import { SubmissionStoresProvider } from "@/features/submissions/components/providers";
import { SubmissionFormLayout } from "@/features/submissions/components/SubmissionFormLayout";
import { CreateSubmissionForm } from "@/features/submissions/components/forms";
import { CertificatePDFPreview } from "@/features/submissions/components/CertificatePDFPreview";
import {
	type SubmissionPhase,
	type Submission,
} from "@/shared/types/backend-api.types";
import { toast } from "sonner";
import { useSubmissionFormStore } from "@/features/submissions/hooks/useSubmissionFormStore";
import { Button } from "@/shared/components/ui/button";
import { Head } from "@/shared/components/layout/Head";

const PHASES: SubmissionPhase[] = [
	"data_entry",
	"finance_approval",
	"botanist_review",
	"documents",
	"send_emails",
	"complete",
];

const DataEntryPhaseContent: React.FC = () => {
	const formStore = useSubmissionFormStore();
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [isSavingDraft, setIsSavingDraft] = React.useState(false);

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const submissionData = formStore.getSubmissionCreateRequest(false);
			console.log("Submission data:", submissionData);
			toast.success("Form validation passed! (Demo mode)");
		} catch (error) {
			console.error("Submission error:", error);
			toast.error("Failed to submit form");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveDraft = async () => {
		setIsSavingDraft(true);
		try {
			const draftData = formStore.getSubmissionCreateRequest(true);
			console.log("Draft data:", draftData);
			toast.success("Draft saved! (Demo mode)");
		} catch (error) {
			console.error("Draft save error:", error);
			toast.error("Failed to save draft");
		} finally {
			setIsSavingDraft(false);
		}
	};

	const handleCancel = () => {
		toast.info("Form cancelled");
	};

	return (
		<SubmissionFormLayout
			formContent={
				<CreateSubmissionForm
					onSubmit={handleSubmit}
					onSaveDraft={handleSaveDraft}
					onCancel={handleCancel}
					isSubmitting={isSubmitting}
					isSavingDraft={isSavingDraft}
				/>
			}
			previewContent={<CertificatePDFPreview />}
			showViewSwitcher={true}
		/>
	);
};

const PhaseProgressDemoContent: React.FC = () => {
	// For demo purposes, simulate being at finance_approval phase
	// This means data_entry is completed
	const [currentPhase, setCurrentPhase] =
		useState<SubmissionPhase>("finance_approval");
	const [viewingPhase, setViewingPhase] =
		useState<SubmissionPhase>("finance_approval");
	const [userRole, setUserRole] = useState<"botanist" | "finance" | "none">(
		"finance"
	);
	const [isAdmin, setIsAdmin] = useState(false);
	const [isAdvancing, setIsAdvancing] = useState(false);
	const [isSendingBack, setIsSendingBack] = useState(false);

	// Calculate completed phases based on current phase
	const currentPhaseIndex = PHASES.indexOf(currentPhase);
	const completedPhases = PHASES.slice(0, currentPhaseIndex);

	const handlePhaseClick = (phase: SubmissionPhase) => {
		setViewingPhase(phase);
	};

	const handleAdvance = async () => {
		setIsAdvancing(true);
		try {
			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const nextPhaseIndex = currentPhaseIndex + 1;
			if (nextPhaseIndex < PHASES.length) {
				const nextPhase = PHASES[nextPhaseIndex];
				setCurrentPhase(nextPhase);
				setViewingPhase(nextPhase);
				toast.success(
					`Advanced to ${nextPhase.replace(/_/g, " ").toUpperCase()}`
				);
			}
		} catch (error) {
			toast.error("Failed to advance phase");
		} finally {
			setIsAdvancing(false);
		}
	};

	const handleSendBack = async (
		targetPhase: SubmissionPhase,
		reason: string
	) => {
		setIsSendingBack(true);
		try {
			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 1000));

			setCurrentPhase(targetPhase);
			setViewingPhase(targetPhase);
			toast.success(
				`Sent back to ${targetPhase
					.replace(/_/g, " ")
					.toUpperCase()}: ${reason}`
			);
		} catch (error) {
			toast.error("Failed to send back");
		} finally {
			setIsSendingBack(false);
		}
	};

	// Create mock submission data for demo
	const mockSubmission: Submission = {
		id: 1,
		case_number: "DEMO-2024-001",
		received: new Date().toISOString(),
		phase: currentPhase,
		phase_display: currentPhase.replace(/_/g, " ").toUpperCase(),
		security_movement_envelope: "WW00263610",
		internal_comments: "Demo submission for testing phase workflow",
		is_draft: false,
		approved_botanist: 1,
		finance_officer: 2,
		requesting_officer: 1,
		submitting_officer: 2,
		station: 1,
		forensic_hours: null,
		fuel_distance_km: null,
		certificates_generated_at: null,
		invoices_generated_at: null,
		approved_botanist_details: {
			id: 1,
			first_name: "Jane",
			last_name: "Smith",
			full_name: "Dr. Jane Smith",
			initials: "JS",
			email: "jane.smith@dbca.wa.gov.au",
			role: "botanist",
			role_display: "Botanist",
			is_staff: true,
			is_superuser: false,
			is_active: true,
			date_joined: new Date().toISOString(),
			last_login: new Date().toISOString(),
		},
		finance_officer_details: {
			id: 2,
			first_name: "John",
			last_name: "Finance",
			full_name: "John Finance",
			initials: "JF",
			email: "john.finance@dbca.wa.gov.au",
			role: "finance",
			role_display: "Finance Officer",
			is_staff: true,
			is_superuser: false,
			is_active: true,
			date_joined: new Date().toISOString(),
			last_login: new Date().toISOString(),
		},
		requesting_officer_details: {
			id: 1,
			badge_number: "PD12345",
			first_name: "David",
			last_name: "DELLAR",
			full_name: "David DELLAR",
			rank: "detective",
			rank_display: "Detective",
			station: 1,
			station_name: "Central Station",
			email: "",
			is_sworn: true,
		},
		submitting_officer_details: {
			id: 2,
			badge_number: "PD67890",
			first_name: "Sarah",
			last_name: "JONES",
			full_name: "Sarah JONES",
			rank: "constable",
			rank_display: "Constable",
			station: 1,
			station_name: "Central Station",
			email: "",
			is_sworn: true,
		},
		station_details: {
			id: 1,
			name: "Central Station",
			phone: "(08) 9000 0000",
			address: "",
			postcode: "",
		},
		defendants: [1, 2],
		defendants_details: [
			{
				id: 1,
				first_name: "John",
				last_name: "DOE",
				full_name: "John DOE",
				cases_count: 2,
			},
			{
				id: 2,
				first_name: "Jane",
				last_name: "SMITH",
				full_name: "Jane SMITH",
				cases_count: 1,
			},
		],
		bags: [
			{
				id: 1,
				submission: 1,
				security_movement_envelope: "WW00263610",
				content_type: "plant",
				content_type_display: "Plant Material",
				seal_tag_numbers: "ABC123, ABC124",
				new_seal_tag_numbers: "XYZ789, XYZ790",
				property_reference: "PROP-001",
				gross_weight: "150.5",
				net_weight: "145.2",
				assessment: {
					id: 1,
					determination: "cannabis_sativa",
					determination_display: "Cannabis sativa",
					is_cannabis: true,
					assessment_date: new Date().toISOString(),
					botanist_notes: "Sample identified as Cannabis sativa",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
			{
				id: 2,
				submission: 1,
				security_movement_envelope: "WW00263610",
				content_type: "seed",
				content_type_display: "Seed",
				seal_tag_numbers: "ABC125",
				new_seal_tag_numbers: "XYZ791",
				property_reference: "PROP-002",
				gross_weight: "25.0",
				net_weight: "24.5",
				assessment: {
					id: 2,
					determination: "cannabis_sativa",
					determination_display: "Cannabis sativa",
					is_cannabis: true,
					assessment_date: new Date().toISOString(),
					botanist_notes: "Seeds identified as Cannabis sativa",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		],
		certificates: [],
		invoices: [],
		additional_fees: [
			// {
			// 	id: 1,
			// 	claim_kind: "fuel",
			// 	claim_kind_display: "Fuel",
			// 	units: 2,
			// 	description: "Travel to collection site",
			// 	calculated_cost: "45.50",
			// 	created_at: new Date().toISOString(),
			// 	updated_at: new Date().toISOString(),
			// },
		],
		phase_history: [],
		cannabis_present: true,
		bags_received: 2,
		total_plants: 1,
		finance_approved_at:
			currentPhaseIndex > 1 ? new Date().toISOString() : null,
		botanist_approved_at:
			currentPhaseIndex > 2 ? new Date().toISOString() : null,
		documents_generated_at:
			currentPhaseIndex > 3 ? new Date().toISOString() : null,
		emails_sent_at: currentPhaseIndex > 4 ? new Date().toISOString() : null,
		completed_at: currentPhaseIndex > 5 ? new Date().toISOString() : null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};

	// Determine if user can edit based on role and phase
	const canEdit = () => {
		if (isAdmin) return true;
		if (viewingPhase === "finance_approval" && userRole === "finance")
			return true;
		if (viewingPhase === "botanist_review" && userRole === "botanist")
			return true;
		if (
			viewingPhase === "documents" &&
			(userRole === "finance" || userRole === "botanist")
		)
			return true;
		if (
			viewingPhase === "send_emails" &&
			(userRole === "finance" || userRole === "botanist")
		)
			return true;
		return false;
	};

	// Render phase-specific content using PhaseContent component
	const renderPhaseContent = () => {
		// Special case for data_entry - use the form
		if (viewingPhase === "data_entry") {
			return <DataEntryPhaseContent />;
		}

		// For all other phases, use the PhaseContent component
		return (
			<PhaseContent
				submission={mockSubmission}
				phase={viewingPhase}
				isCurrentPhase={viewingPhase === currentPhase}
				canEdit={canEdit()}
				onUpdate={async (data) => {
					console.log("Update submission:", data);
					toast.success("Submission updated (demo mode)");
				}}
			/>
		);
	};

	return (
		<div className="space-y-6">
			<Head title="Phase Progress Demo" />

			{/* Demo Controls */}
			<div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl shadow-lg p-6 border border-amber-200 dark:border-amber-800">
				<h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-4">
					Demo Controls
				</h3>
				<div className="flex flex-wrap gap-4">
					<div>
						<label className="block text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
							User Role:
						</label>
						<div className="flex gap-2">
							<Button
								size="sm"
								variant={
									userRole === "finance"
										? "default"
										: "outline"
								}
								onClick={() => setUserRole("finance")}
							>
								Finance Officer
							</Button>
							<Button
								size="sm"
								variant={
									userRole === "botanist"
										? "default"
										: "outline"
								}
								onClick={() => setUserRole("botanist")}
							>
								Botanist
							</Button>
							<Button
								size="sm"
								variant={
									userRole === "none" ? "default" : "outline"
								}
								onClick={() => setUserRole("none")}
							>
								No Role
							</Button>
						</div>
					</div>
					<div>
						<label className="block text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
							Admin Override:
						</label>
						<Button
							size="sm"
							variant={isAdmin ? "default" : "outline"}
							onClick={() => setIsAdmin(!isAdmin)}
						>
							{isAdmin ? "Admin: ON" : "Admin: OFF"}
						</Button>
					</div>
				</div>
			</div>

			{/* Phase Progress Indicator */}
			<PhaseProgressIndicator
				currentPhase={currentPhase}
				completedPhases={completedPhases}
				viewingPhase={viewingPhase}
				onPhaseClick={handlePhaseClick}
			/>

			{/* Phase Actions Bar */}
			<PhaseActionsBar
				currentPhase={currentPhase}
				viewingPhase={viewingPhase}
				isCurrentPhase={viewingPhase === currentPhase}
				userRole={userRole}
				isAdmin={isAdmin}
				isAdvancing={isAdvancing}
				isSendingBack={isSendingBack}
				onAdvance={handleAdvance}
				onSendBack={handleSendBack}
			/>

			{/* Phase Content */}
			{renderPhaseContent()}
		</div>
	);
};

const PhaseProgressDemo: React.FC = () => {
	const breadcrumbs = [
		{ label: "Submissions", href: "/submissions" },
		{ label: "Phase Workflow Demo", current: true },
	];

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="full">
			<SubmissionStoresProvider>
				<PhaseProgressDemoContent />
			</SubmissionStoresProvider>
		</ContentLayout>
	);
};

export default PhaseProgressDemo;
