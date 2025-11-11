import React from "react";
import { observer } from "mobx-react-lite";
import { useCertificatePreviewStore } from "@/features/submissions/hooks/useCertificatePreviewStore";
import { FileText, AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import type { DefendantTiny } from "@/shared/types/backend-api.types";
import type { DrugBagFormData } from "@/features/submissions/stores/submissionForm.store";

interface CertificatePreviewProps {
	className?: string;
}

export const CertificatePreview: React.FC<CertificatePreviewProps> = observer(
	({ className }) => {
		const previewStore = useCertificatePreviewStore();

		// Show placeholder if no preview data
		if (!previewStore.state.previewData) {
			return (
				<div
					className={cn(
						"flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/50",
						className
					)}
				>
					<FileText className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium mb-2">
						No Preview Available
					</h3>
					<p className="text-sm text-muted-foreground max-w-md">
						Complete the required fields (Case Number, Received
						Date, and Envelope Number) to see the certificate
						preview.
					</p>
				</div>
			);
		}

		const data = previewStore.state.previewData;

		return (
			<div
				className={cn(
					"bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 space-y-6 transition-opacity duration-200",
					className
				)}
			>
				{/* Header */}
				<div className="border-b pb-4">
					<h1 className="text-2xl font-bold text-center">
						Botanical Identification Certificate
					</h1>
					<p className="text-sm text-center text-muted-foreground mt-2">
						Cannabis Management System
					</p>
				</div>

				{/* Case Information */}
				<div className="space-y-3">
					<h2 className="text-lg font-semibold border-b pb-2">
						Case Information
					</h2>
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span className="font-medium">Case Number:</span>
							<p className="text-muted-foreground">
								{data.case_number || "N/A"}
							</p>
						</div>
						<div>
							<span className="font-medium">Received Date:</span>
							<p className="text-muted-foreground">
								{data.received_date
									? new Date(
											data.received_date
									  ).toLocaleDateString()
									: "N/A"}
							</p>
						</div>
					</div>
				</div>

				{/* Officers and Station */}
				{(data.requesting_officer ||
					data.submitting_officer ||
					data.station) && (
					<div className="space-y-3">
						<h2 className="text-lg font-semibold border-b pb-2">
							Police Information
						</h2>
						<div className="grid grid-cols-1 gap-3 text-sm">
							{data.requesting_officer && (
								<div>
									<span className="font-medium">
										Requesting Officer:
									</span>
									<p className="text-muted-foreground">
										{data.requesting_officer.full_name}
										{data.requesting_officer.badge_number &&
											` (Badge: ${data.requesting_officer.badge_number})`}
									</p>
								</div>
							)}
							{data.submitting_officer && (
								<div>
									<span className="font-medium">
										Submitting Officer:
									</span>
									<p className="text-muted-foreground">
										{data.submitting_officer.full_name}
										{data.submitting_officer.badge_number &&
											` (Badge: ${data.submitting_officer.badge_number})`}
									</p>
								</div>
							)}
							{data.station && (
								<div>
									<span className="font-medium">
										Station:
									</span>
									<p className="text-muted-foreground">
										{data.station.name}
									</p>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Defendants */}
				{data.defendants.length > 0 && (
					<div className="space-y-3">
						<h2 className="text-lg font-semibold border-b pb-2">
							Defendants
						</h2>
						<ul className="list-disc list-inside text-sm space-y-1">
							{data.defendants.map(
								(defendant: DefendantTiny, index: number) => (
									<li
										key={index}
										className="text-muted-foreground"
									>
										{defendant.full_name}
									</li>
								)
							)}
						</ul>
					</div>
				)}

				{/* Drug Bags Summary */}
				<div className="space-y-3">
					<h2 className="text-lg font-semibold border-b pb-2">
						Evidence Summary
					</h2>
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span className="font-medium">Total Bags:</span>
							<p className="text-muted-foreground">
								{data.total_bags}
							</p>
						</div>
						<div>
							<span className="font-medium">
								Cannabis Present:
							</span>
							<p
								className={cn(
									"font-medium",
									data.cannabis_present
										? "text-green-600 dark:text-green-400"
										: "text-gray-600 dark:text-gray-400"
								)}
							>
								{data.cannabis_present ? "Yes" : "No"}
							</p>
						</div>
					</div>
				</div>

				{/* Drug Bags Details */}
				{data.bags.length > 0 && (
					<div className="space-y-3">
						<h2 className="text-lg font-semibold border-b pb-2">
							Evidence Details
						</h2>
						<div className="space-y-4">
							{data.bags.map(
								(bag: DrugBagFormData, index: number) => (
									<div
										key={index}
										className="border rounded-lg p-4 space-y-2 text-sm"
									>
										<div className="flex items-center justify-between">
											<span className="font-medium">
												Bag {index + 1}
											</span>
											<span className="text-xs text-muted-foreground">
												{bag.content_type
													.replace("_", " ")
													.toUpperCase()}
											</span>
										</div>
										{bag.seal_tag_numbers && (
											<div>
												<span className="font-medium">
													Seal Tags:
												</span>
												<p className="text-muted-foreground">
													{bag.seal_tag_numbers}
												</p>
											</div>
										)}
										{bag.determination &&
											bag.determination !== "pending" && (
												<div>
													<span className="font-medium">
														Determination:
													</span>
													<p
														className={cn(
															"font-medium",
															bag.determination.includes(
																"cannabis"
															)
																? "text-green-600 dark:text-green-400"
																: "text-gray-600 dark:text-gray-400"
														)}
													>
														{bag.determination
															.replace(/_/g, " ")
															.replace(
																/\b\w/g,
																(l: string) =>
																	l.toUpperCase()
															)}
													</p>
												</div>
											)}
										{bag.gross_weight && (
											<div>
												<span className="font-medium">
													Gross Weight:
												</span>
												<p className="text-muted-foreground">
													{bag.gross_weight}g
												</p>
											</div>
										)}
									</div>
								)
							)}
						</div>
					</div>
				)}

				{/* Botanist */}
				{data.approved_botanist && (
					<div className="space-y-3">
						<h2 className="text-lg font-semibold border-b pb-2">
							Approved By
						</h2>
						<div className="text-sm">
							<p className="font-medium">
								{data.approved_botanist.full_name}
							</p>
							<p className="text-muted-foreground">
								{data.approved_botanist.email}
							</p>
						</div>
					</div>
				)}

				{/* Placeholder Notice */}
				<div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
					<div className="flex items-start gap-3">
						<AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
						<div className="text-sm">
							<p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
								Placeholder Preview
							</p>
							<p className="text-blue-700 dark:text-blue-300">
								This is a placeholder certificate preview. The
								actual PDF template will be integrated in Task
								7. Please provide the PDF template for proper
								integration.
							</p>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="border-t pt-4 text-xs text-center text-muted-foreground">
					<p>
						This certificate is generated by the Cannabis Management
						System
					</p>
					<p className="mt-1">
						Generated on: {new Date().toLocaleDateString()}
					</p>
				</div>
			</div>
		);
	}
);

CertificatePreview.displayName = "CertificatePreview";
