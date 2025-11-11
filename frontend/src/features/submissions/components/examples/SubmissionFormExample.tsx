import React from "react";
import { observer } from "mobx-react-lite";
import { useSubmissionFormStore } from "@/features/submissions/hooks/useSubmissionFormStore";
import { useCertificatePreviewStore } from "@/features/submissions/hooks/useCertificatePreviewStore";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";

/**
 * Example component demonstrating MobX form store usage
 * This shows the reactive patterns and computed values
 */
export const SubmissionFormExample: React.FC = observer(() => {
	const formStore = useSubmissionFormStore();
	const previewStore = useCertificatePreviewStore();

	// Handle form submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formStore.canSubmit) {
			return;
		}

		formStore.setSubmitting(true);

		try {
			// Validate form
			const isValid = formStore.validateForm();
			if (!isValid) {
				console.log(
					"Form validation failed:",
					formStore.validationErrors
				);
				return;
			}

			// Get API request data
			const requestData = formStore.getSubmissionCreateRequest();
			console.log("Submission data:", requestData);

			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Clear form on success
			formStore.resetForm();
		} catch (error) {
			console.error("Submission failed:", error);
		} finally {
			formStore.setSubmitting(false);
		}
	};

	// Update preview when form data changes (reactive)
	React.useEffect(() => {
		if (formStore.requiredFieldsCompleted) {
			previewStore.setPreviewData(formStore.certificateData);
		} else {
			previewStore.setPreviewData(null);
		}
	}, [
		formStore.certificateData,
		formStore.requiredFieldsCompleted,
		previewStore,
	]);

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			{/* Form Section */}
			<Card>
				<CardHeader>
					<CardTitle>
						Submission Form
						{formStore.isDirty && (
							<span className="text-orange-500 ml-2">*</span>
						)}
					</CardTitle>
					<div className="text-sm text-muted-foreground">
						Progress: {formStore.formProgress}% | View:{" "}
						{formStore.currentView} | Bags: {formStore.totalBags}
					</div>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Case Details */}
						<div className="space-y-2">
							<Label htmlFor="case_number">Case Number</Label>
							<Input
								id="case_number"
								value={formStore.formData.case_number}
								onChange={(e) =>
									formStore.updateField(
										"case_number",
										e.target.value
									)
								}
								placeholder="Enter case number"
							/>
							{formStore.validationErrors.case_number && (
								<p className="text-sm text-red-500">
									{formStore.validationErrors.case_number}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="received">Received Date</Label>
							<Input
								id="received"
								type="datetime-local"
								value={formStore.formData.received}
								onChange={(e) =>
									formStore.updateField(
										"received",
										e.target.value
									)
								}
							/>
							{formStore.validationErrors.received && (
								<p className="text-sm text-red-500">
									{formStore.validationErrors.received}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="envelope">
								Security Movement Envelope
							</Label>
							<Input
								id="envelope"
								value={
									formStore.formData
										.security_movement_envelope
								}
								onChange={(e) =>
									formStore.updateField(
										"security_movement_envelope",
										e.target.value
									)
								}
								placeholder="Enter envelope number"
							/>
							{formStore.validationErrors
								.security_movement_envelope && (
								<p className="text-sm text-red-500">
									{
										formStore.validationErrors
											.security_movement_envelope
									}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="comments">Internal Comments</Label>
							<Textarea
								id="comments"
								value={formStore.formData.internal_comments}
								onChange={(e) =>
									formStore.updateField(
										"internal_comments",
										e.target.value
									)
								}
								placeholder="Enter internal comments"
								rows={3}
							/>
						</div>

						{/* Drug Bags Section */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label>Drug Bags ({formStore.totalBags})</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={formStore.addDrugBag}
								>
									Add Bag
								</Button>
							</div>

							{formStore.formData.bags.map((bag, index) => (
								<Card key={index} className="p-3">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm font-medium">
											Bag {index + 1}
										</span>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() =>
												formStore.removeDrugBag(index)
											}
										>
											Remove
										</Button>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<Label>Content Type</Label>
											<select
												value={bag.content_type}
												onChange={(e) =>
													formStore.updateDrugBag(
														index,
														{
															content_type: e
																.target
																.value as any,
														}
													)
												}
												className="w-full p-2 border rounded"
											>
												<option value="unknown">
													Unknown
												</option>
												<option value="plant">
													Plant
												</option>
												<option value="seed">
													Seed
												</option>
												<option value="cutting">
													Cutting
												</option>
											</select>
										</div>
										<div>
											<Label>Tag Numbers</Label>
											<Input
												value={bag.seal_tag_numbers}
												onChange={(e) =>
													formStore.updateDrugBag(
														index,
														{
															seal_tag_numbers:
																e.target.value,
														}
													)
												}
												placeholder="Tag numbers"
											/>
										</div>
									</div>
								</Card>
							))}
						</div>

						{/* View Mode Controls */}
						<div className="space-y-2">
							<Label>View Mode</Label>
							<div className="flex gap-2">
								{(
									[
										"data-entry",
										"dual-view",
										"preview-only",
									] as const
								).map((mode) => (
									<Button
										key={mode}
										type="button"
										variant={
											formStore.currentView === mode
												? "default"
												: "outline"
										}
										size="sm"
										onClick={() => formStore.setView(mode)}
									>
										{mode
											.replace("-", " ")
											.replace(/\b\w/g, (l) =>
												l.toUpperCase()
											)}
									</Button>
								))}
							</div>
						</div>

						{/* Form Actions */}
						<div className="flex gap-2 pt-4">
							<Button
								type="submit"
								disabled={!formStore.canSubmit}
								className="flex-1"
							>
								{formStore.isSubmitting
									? "Submitting..."
									: "Submit"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={formStore.resetForm}
							>
								Reset
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={formStore.saveDraft}
							>
								Save Draft
							</Button>
						</div>

						{/* Form Status */}
						<div className="text-xs text-muted-foreground space-y-1">
							<div>Valid: {formStore.isValid ? "Yes" : "No"}</div>
							<div>
								Required Fields:{" "}
								{formStore.requiredFieldsCompleted
									? "Complete"
									: "Incomplete"}
							</div>
							<div>
								Has Assessments:{" "}
								{formStore.hasAssessments ? "Yes" : "No"}
							</div>
							{formStore.lastSaved && (
								<div>
									Last Saved:{" "}
									{formStore.lastSaved.toLocaleTimeString()}
								</div>
							)}
						</div>
					</form>
				</CardContent>
			</Card>

			{/* Preview Section */}
			<Card>
				<CardHeader>
					<CardTitle>
						Certificate Preview
						{previewStore.state.isGenerating && (
							<span className="text-blue-500 ml-2">
								Generating...
							</span>
						)}
					</CardTitle>
					<div className="text-sm text-muted-foreground">
						{previewStore.previewSummary}
					</div>
				</CardHeader>
				<CardContent>
					{previewStore.state.error ? (
						<div className="text-red-500 p-4 border border-red-200 rounded">
							Error: {previewStore.state.error}
						</div>
					) : previewStore.hasData ? (
						<div
							className="border rounded p-4 bg-gray-50 min-h-[400px] text-sm"
							dangerouslySetInnerHTML={{
								__html: previewStore.getPreviewHTML(),
							}}
						/>
					) : (
						<div className="text-muted-foreground p-4 text-center">
							Complete the required fields to see preview
						</div>
					)}

					{/* Preview Controls */}
					<div className="mt-4 space-y-2">
						<div className="flex items-center gap-2">
							<Label>Template:</Label>
							<select
								value={previewStore.formatOptions.template}
								onChange={(e) =>
									previewStore.setTemplate(
										e.target.value as any
									)
								}
								className="p-1 border rounded text-sm"
							>
								<option value="standard">Standard</option>
								<option value="detailed">Detailed</option>
								<option value="summary">Summary</option>
							</select>
						</div>

						<div className="flex items-center gap-4 text-sm">
							<label className="flex items-center gap-1">
								<input
									type="checkbox"
									checked={
										previewStore.formatOptions
											.includeAssessmentNotes
									}
									onChange={() =>
										previewStore.toggleOption(
											"includeAssessmentNotes"
										)
									}
								/>
								Assessment Notes
							</label>
							<label className="flex items-center gap-1">
								<input
									type="checkbox"
									checked={
										previewStore.formatOptions.watermark
									}
									onChange={() =>
										previewStore.toggleOption("watermark")
									}
								/>
								Watermark
							</label>
						</div>

						<div className="text-xs text-muted-foreground">
							Preview updates automatically as you type
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
});
