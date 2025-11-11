import { observer } from "mobx-react-lite";
import { type Submission } from "@/shared/types/backend-api.types";
import { FileText, Calendar, User, Package, Shield, Users } from "lucide-react";
import { CreateSubmissionForm } from "../forms/CreateSubmissionForm";
import { SubmissionStoresProvider } from "../providers/SubmissionStoresProvider";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";

interface DataEntryPhaseContentProps {
	submission: Submission;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Submission>) => Promise<void>;
}

/**
 * Data Entry Phase Content Component
 *
 * Displays the submission form with all entered data.
 * - Editable form when current phase with edit permission
 * - Read-only summary when completed phase
 * - Shows submission creator and timestamp
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const DataEntryPhaseContent = observer<DataEntryPhaseContentProps>(
	({ submission, isCurrentPhase, canEdit, onUpdate }) => {
		// If current phase and can edit, show editable form
		if (isCurrentPhase && canEdit) {
			return (
				<div className="space-y-4">
					{/* Historical data indicator */}
					<div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded">
						<div className="flex items-center gap-2">
							<FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
							<div>
								<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
									Editing Data Entry Phase
								</p>
								<p className="text-xs text-blue-700 dark:text-blue-300">
									You can edit the submission details below.
									Changes will be saved to the submission.
								</p>
							</div>
						</div>
					</div>

					{/* Editable form wrapped in store provider */}
					<SubmissionStoresProvider>
						<CreateSubmissionForm
							onSubmit={async () => {
								// TODO: Implement update logic
								if (onUpdate) {
									await onUpdate({});
								}
							}}
							onCancel={() => {
								// TODO: Implement cancel logic
							}}
						/>
					</SubmissionStoresProvider>
				</div>
			);
		}

		// Otherwise, show read-only summary
		return (
			<div className="space-y-6">
				{/* Historical data indicator */}
				{!isCurrentPhase && (
					<div className="p-4 bg-gray-50 border-l-4 border-gray-400 rounded">
						<div className="flex items-center gap-2">
							<FileText className="h-5 w-5 text-gray-600" />
							<div>
								<p className="text-sm font-medium text-gray-900">
									Viewing Historical Data
								</p>
								<p className="text-xs text-gray-600">
									This is a read-only view of the data entry
									phase. The submission has moved to{" "}
									{submission.phase_display}.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Submission metadata */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<User className="h-5 w-5" />
							Submission Information
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Created By
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.created_at
										? new Date(
												submission.created_at
										  ).toLocaleString()
										: "Unknown"}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Last Updated
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.updated_at
										? new Date(
												submission.updated_at
										  ).toLocaleString()
										: "Unknown"}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Case Details Summary */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Case Details
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Police Reference No.
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.case_number}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Received Date
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									{new Date(
										submission.received
									).toLocaleDateString()}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Security Movement Envelope
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.security_movement_envelope}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Status
								</p>
								<Badge
									variant={
										submission.is_draft
											? "secondary"
											: "default"
									}
								>
									{submission.is_draft
										? "Draft"
										: "Finalized"}
								</Badge>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Officers and Station Summary */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Shield className="h-5 w-5" />
							Officers & Station
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Requesting Officer
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.requesting_officer_details
										?.full_name || "Not assigned"}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Submitting Officer
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.submitting_officer_details
										?.full_name || "Not assigned"}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Police Station
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.station_details?.name ||
										"Not assigned"}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Approved Botanist
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.approved_botanist_details
										?.full_name || "Not assigned"}
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
									Finance Officer
								</p>
								<p className="text-base text-gray-900 dark:text-gray-100">
									{submission.finance_officer_details
										?.full_name || "Not assigned"}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Defendants Summary */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Defendants ({submission.defendants_details.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						{submission.defendants_details.length > 0 ? (
							<div className="space-y-2">
								{submission.defendants_details.map(
									(defendant) => (
										<div
											key={defendant.id}
											className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
										>
											<p className="text-base text-gray-900 dark:text-gray-100">
												{defendant.full_name}
											</p>
											{defendant.cases_count > 0 && (
												<p className="text-xs text-gray-500">
													{defendant.cases_count}{" "}
													associated case(s)
												</p>
											)}
										</div>
									)
								)}
							</div>
						) : (
							<p className="text-sm text-gray-500 dark:text-gray-400">
								No defendants assigned
							</p>
						)}
					</CardContent>
				</Card>

				{/* Drug Bags Summary */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Package className="h-5 w-5" />
							Drug Bags ({submission.bags.length})
						</CardTitle>
					</CardHeader>
					<CardContent>
						{submission.bags.length > 0 ? (
							<div className="space-y-3">
								{submission.bags.map((bag, index) => (
									<div
										key={bag.id}
										className="p-4 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
									>
										<div className="flex items-start justify-between mb-2">
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
												Bag {index + 1}
											</p>
											<Badge variant="outline">
												{bag.content_type_display}
											</Badge>
										</div>
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div>
												<span className="text-gray-500 dark:text-gray-400">
													Original Tags:
												</span>
												<span className="ml-2 text-gray-900 dark:text-gray-100">
													{bag.seal_tag_numbers}
												</span>
											</div>
											<div>
												<span className="text-gray-500 dark:text-gray-400">
													New Tags:
												</span>
												<span className="ml-2 text-gray-900 dark:text-gray-100">
													{bag.new_seal_tag_numbers ||
														"N/A"}
												</span>
											</div>
											{bag.gross_weight && (
												<div>
													<span className="text-gray-500 dark:text-gray-400">
														Gross Weight:
													</span>
													<span className="ml-2 text-gray-900 dark:text-gray-100">
														{bag.gross_weight}g
													</span>
												</div>
											)}
											{bag.net_weight && (
												<div>
													<span className="text-gray-500 dark:text-gray-400">
														Net Weight:
													</span>
													<span className="ml-2 text-gray-900 dark:text-gray-100">
														{bag.net_weight}g
													</span>
												</div>
											)}
										</div>
										{bag.assessment?.determination &&
											bag.assessment.determination !==
												"pending" && (
												<div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
													<span className="text-sm text-gray-500 dark:text-gray-400">
														Determination:
													</span>
													<span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100">
														{
															bag.assessment
																.determination_display
														}
													</span>
												</div>
											)}
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-gray-500 dark:text-gray-400">
								No drug bags recorded
							</p>
						)}
					</CardContent>
				</Card>

				{/* Internal Comments */}
				{submission.internal_comments && (
					<Card>
						<CardHeader>
							<CardTitle>Internal Comments</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
								{submission.internal_comments}
							</p>
						</CardContent>
					</Card>
				)}
			</div>
		);
	}
);

DataEntryPhaseContent.displayName = "DataEntryPhaseContent";
