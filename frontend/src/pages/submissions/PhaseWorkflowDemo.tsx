import React, { useState } from "react";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import {
	PhaseIndicator,
	PhaseBadge,
	WorkflowActions,
	WorkflowActionsCompact,
	getPhaseProgress,
	getNextPhase,
	type UISubmissionPhase,
} from "@/features/submissions/components";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { toast } from "sonner";
import type { Submission, SubmissionPhase } from "@/shared/types/backend-api.types";
import { Head } from "@/shared/components/layout/Head";

// Map backend phases to UI phases for demo purposes
const mapBackendToUIPhase = (backendPhase: SubmissionPhase): UISubmissionPhase => {
	const mapping: Record<SubmissionPhase, UISubmissionPhase> = {
		data_entry: "data_entry_start",
		finance_approval: "finance_approval_provided",
		botanist_review: "botanist_approval_provided",
		documents: "certificate_generation_start",
		send_emails: "sending_emails",
		complete: "complete",
	};
	return mapping[backendPhase];
};

// Map UI phases back to backend phases
const mapUIToBackendPhase = (uiPhase: UISubmissionPhase): SubmissionPhase => {
	const mapping: Record<UISubmissionPhase, SubmissionPhase> = {
		data_entry_start: "data_entry",
		finance_approval_provided: "finance_approval",
		botanist_approval_provided: "botanist_review",
		in_review: "botanist_review", // Maps to botanist_review
		certificate_generation_start: "documents",
		invoice_generation_start: "documents", // Maps to documents
		sending_emails: "send_emails",
		complete: "complete",
	};
	return mapping[uiPhase];
};

// Mock submission data for demo
const createMockSubmission = (phase: SubmissionPhase): Submission => ({
	id: 1,
	case_number: "DEMO-2024-001",
	received: "2024-10-14T09:00:00Z",
	phase,
	phase_display: phase
		.replace(/_/g, " ")
		.replace(/\b\w/g, (l: string) => l.toUpperCase()),
	security_movement_envelope: "WW00263610",
	internal_comments: "Demo submission for testing phase workflow",
	is_draft: false,
	forensic_hours: "2.5",
	fuel_distance_km: "50.0",
	approved_botanist: 1,
	finance_officer: 2,
	requesting_officer: null,
	submitting_officer: null,
	station: null,
	approved_botanist_details: null,
	finance_officer_details: null,
	requesting_officer_details: null,
	submitting_officer_details: null,
	station_details: null,
	defendants: [],
	defendants_details: [],
	bags: [
		{
			id: 1,
			submission: 1,
			content_type: "plant",
			content_type_display: "Plant Material",
			seal_tag_numbers: "TAG001",
			new_seal_tag_numbers: "TAG002",
			property_reference: "PROP001",
			gross_weight: "10.5",
			net_weight: "9.8",
			security_movement_envelope: "WW00263610",
			assessment: {
				id: 1,
				determination: "cannabis_sativa",
				determination_display: "Cannabis sativa",
				is_cannabis: true,
				assessment_date: "2024-10-14T10:00:00Z",
				botanist_notes: "Identified as Cannabis sativa",
				created_at: "2024-10-14T10:00:00Z",
				updated_at: "2024-10-14T10:00:00Z",
			},
			created_at: "2024-10-14T09:00:00Z",
			updated_at: "2024-10-14T09:00:00Z",
		},
	],
	certificates: [],
	invoices: [],
	additional_fees: [],
	phase_history: [],
	finance_approved_at:
		phase !== "data_entry" ? "2024-10-14T09:30:00Z" : null,
	botanist_approved_at:
		phase !== "data_entry" && phase !== "finance_approval"
			? "2024-10-14T10:00:00Z"
			: null,
	documents_generated_at: null,
	certificates_generated_at: null,
	invoices_generated_at: null,
	emails_sent_at: null,
	completed_at: null,
	cannabis_present: true,
	bags_received: 1,
	total_plants: 1,
	created_at: "2024-10-14T09:00:00Z",
	updated_at: "2024-10-14T09:00:00Z",
});

export const PhaseWorkflowDemo: React.FC = () => {
	const [currentPhase, setCurrentPhase] =
		useState<SubmissionPhase>("data_entry");
	const [userRole, setUserRole] = useState<"botanist" | "finance" | "none">(
		"botanist"
	);
	const [variant, setVariant] = useState<"horizontal" | "vertical">(
		"horizontal"
	);

	const mockSubmission = createMockSubmission(currentPhase);
	const uiPhase = mapBackendToUIPhase(currentPhase);

	const handleAdvancePhase = async (
		_submissionId: number,
		targetPhase: UISubmissionPhase
	) => {
		// Convert UI phase back to backend phase
		const backendPhase = mapUIToBackendPhase(targetPhase);
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));
		setCurrentPhase(backendPhase);
		toast.success(`Phase advanced to ${targetPhase.replace(/_/g, " ")}`);
	};

	const breadcrumbs = [
		{ label: "Submissions", href: "/submissions" },
		{ label: "Phase Workflow Demo", current: true },
	];

	const progress = getPhaseProgress(uiPhase);
	const nextPhase = getNextPhase(uiPhase);

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="xl">
			<Head title="Phase Workflow Demo" />
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-3xl font-bold">Phase Workflow Demo</h1>
					<p className="mt-2 text-gray-600">
						Interactive demonstration of the submission phase
						workflow system with visual progress indicators and
						workflow actions.
					</p>
				</div>

				{/* Controls */}
				<SectionWrapper variant="minimal">
					<div className="space-y-4">
						<h2 className="text-lg font-semibold">Demo Controls</h2>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{/* Phase selector */}
							<div>
								<label className="mb-2 block text-sm font-medium">
									Current Phase (Backend)
								</label>
								<select
									value={currentPhase}
									onChange={(e) =>
										setCurrentPhase(
											e.target.value as SubmissionPhase
										)
									}
									className="w-full rounded-md border border-gray-300 px-3 py-2"
								>
									<option value="data_entry">
										Data Entry
									</option>
									<option value="finance_approval">
										Finance Approval
									</option>
									<option value="botanist_review">
										Botanist Review
									</option>
									<option value="documents">
										Documents
									</option>
									<option value="send_emails">
										Send Emails
									</option>
									<option value="complete">Complete</option>
								</select>
							</div>

							{/* User role selector */}
							<div>
								<label className="mb-2 block text-sm font-medium">
									User Role
								</label>
								<select
									value={userRole}
									onChange={(e) =>
										setUserRole(
											e.target.value as
												| "botanist"
												| "finance"
												| "none"
										)
									}
									className="w-full rounded-md border border-gray-300 px-3 py-2"
								>
									<option value="botanist">Botanist</option>
									<option value="finance">
										Finance Officer
									</option>
									<option value="none">No Role</option>
								</select>
							</div>

							{/* Variant selector */}
							<div>
								<label className="mb-2 block text-sm font-medium">
									Indicator Variant
								</label>
								<select
									value={variant}
									onChange={(e) =>
										setVariant(
											e.target.value as
												| "horizontal"
												| "vertical"
										)
									}
									className="w-full rounded-md border border-gray-300 px-3 py-2"
								>
									<option value="horizontal">
										Horizontal
									</option>
									<option value="vertical">Vertical</option>
								</select>
							</div>
						</div>

						{/* Progress info */}
						<div className="flex items-center gap-4 rounded-lg bg-blue-50 p-4">
							<div className="flex-1">
								<div className="text-sm font-medium text-blue-900">
									Progress: {progress}%
								</div>
								<div className="text-xs text-blue-700">
									{nextPhase
										? `Next phase: ${nextPhase.replace(
												/_/g,
												" "
										  )}`
										: "Workflow complete"}
								</div>
							</div>
							<PhaseBadge phase={uiPhase} />
						</div>
					</div>
				</SectionWrapper>

				{/* Phase Indicator */}
				<Card>
					<CardHeader>
						<CardTitle>Phase Indicator Component</CardTitle>
						<CardDescription>
							Visual progress display showing all workflow phases
							with current status
						</CardDescription>
					</CardHeader>
					<CardContent>
						<PhaseIndicator
							currentPhase={uiPhase}
							variant={variant}
							showLabels={true}
							showDescriptions={variant === "vertical"}
						/>
					</CardContent>
				</Card>

				{/* Workflow Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Workflow Actions Component</CardTitle>
						<CardDescription>
							Interactive controls for advancing submission
							through workflow phases with role-based restrictions
						</CardDescription>
					</CardHeader>
					<CardContent>
						<WorkflowActions
							submission={mockSubmission}
							userRole={userRole}
							onAdvancePhase={handleAdvancePhase}
						/>

						<div className="mt-4 rounded-lg bg-gray-50 p-4">
							<h3 className="mb-2 text-sm font-semibold">
								Role-Based Restrictions:
							</h3>
							<ul className="space-y-1 text-sm text-gray-600">
								<li>
									• Data Entry → Finance Approval: Botanist or
									Finance can advance
								</li>
								<li>
									• Finance Approval → Botanist Approval: Only
									Finance can advance
								</li>
								<li>
									• Botanist Approval → Review: Only Botanist
									can advance
								</li>
								<li>
									• Review → Certificate Generation: Botanist
									or Finance can advance
								</li>
								<li>
									• Later phases are automated by the system
								</li>
							</ul>
						</div>
					</CardContent>
				</Card>

				{/* Compact Workflow Actions */}
				<Card>
					<CardHeader>
						<CardTitle>Compact Workflow Actions</CardTitle>
						<CardDescription>
							Inline version for use in tables and compact layouts
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-4">
							<span className="text-sm text-gray-600">
								Inline display:
							</span>
							<WorkflowActionsCompact
								submission={mockSubmission}
								userRole={userRole}
								onAdvancePhase={handleAdvancePhase}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Phase Badges */}
				<Card>
					<CardHeader>
						<CardTitle>Phase Badges (UI Phases)</CardTitle>
						<CardDescription>
							Compact badges for displaying phase status in tables
							and lists (UI-only phases for visual display)
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							<PhaseBadge phase="data_entry_start" />
							<PhaseBadge phase="finance_approval_provided" />
							<PhaseBadge phase="botanist_approval_provided" />
							<PhaseBadge phase="in_review" />
							<PhaseBadge phase="certificate_generation_start" />
							<PhaseBadge phase="invoice_generation_start" />
							<PhaseBadge phase="sending_emails" />
							<PhaseBadge phase="complete" />
						</div>
					</CardContent>
				</Card>

				{/* Timestamp Tracking */}
				<Card>
					<CardHeader>
						<CardTitle>Workflow Timestamps</CardTitle>
						<CardDescription>
							Automatic timestamp tracking for audit trail and
							compliance
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-600">
									Finance Approved:
								</span>
								<span className="font-medium">
									{mockSubmission.finance_approved_at ||
										"Not yet"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">
									Botanist Approved:
								</span>
								<span className="font-medium">
									{mockSubmission.botanist_approved_at ||
										"Not yet"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">
									Certificates Generated:
								</span>
								<span className="font-medium">
									{mockSubmission.certificates_generated_at ||
										"Not yet"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">
									Invoices Generated:
								</span>
								<span className="font-medium">
									{mockSubmission.invoices_generated_at ||
										"Not yet"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">
									Emails Sent:
								</span>
								<span className="font-medium">
									{mockSubmission.emails_sent_at || "Not yet"}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-600">
									Completed:
								</span>
								<span className="font-medium">
									{mockSubmission.completed_at || "Not yet"}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Usage Examples */}
				<Card>
					<CardHeader>
						<CardTitle>Usage Examples</CardTitle>
						<CardDescription>
							Code examples for implementing phase workflow
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div>
								<h3 className="mb-2 text-sm font-semibold">
									Basic Phase Indicator:
								</h3>
								<pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
									{`<PhaseIndicator
  currentPhase={submission.phase}
  variant="horizontal"
  showLabels={true}
/>`}
								</pre>
							</div>

							<div>
								<h3 className="mb-2 text-sm font-semibold">
									Workflow Actions with Hook:
								</h3>
								<pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
									{`const { executeWorkflowAction } = useSubmissions();

const handleAdvancePhase = async (id: number, phase: SubmissionPhase) => {
  await executeWorkflowAction({
    id,
    action: { action: "advance_phase" }
  });
};

<WorkflowActions
  submission={submission}
  userRole={currentUser.role}
  onAdvancePhase={handleAdvancePhase}
/>`}
								</pre>
							</div>

							<div>
								<h3 className="mb-2 text-sm font-semibold">
									Phase Badge in Table:
								</h3>
								<pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
									{`<TableCell>
  <PhaseBadge phase={submission.phase} />
</TableCell>`}
								</pre>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</ContentLayout>
	);
};
