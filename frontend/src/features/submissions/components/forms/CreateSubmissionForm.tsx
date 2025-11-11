import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
} from "@/shared/components/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { FileText, Shield, Package, Save, X } from "lucide-react";
import { useSubmissionFormStore } from "../../hooks/useSubmissionFormStore";
import { CaseDetailsSection } from "./sections/CaseDetailsSection";
import { OfficersStationSection } from "./sections/OfficersStationSection";
import { DefendantsSection } from "./sections/DefendantsSection";
import { DrugBagsSection } from "./sections/DrugBagsSection";
import { TabProgressIndicator } from "./TabProgressIndicator";
import type { FormSection } from "../../stores/submissionForm.store";

interface CreateSubmissionFormProps {
	onSubmit: () => Promise<void>;
	onSaveDraft?: () => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
	isSavingDraft?: boolean;
}

export const CreateSubmissionForm = observer<CreateSubmissionFormProps>(
	({
		onSubmit,
		onSaveDraft,
		onCancel,
		isSubmitting = false,
		isSavingDraft = false,
	}) => {
		const formStore = useSubmissionFormStore();

		// Sync submitting state with store
		useEffect(() => {
			formStore.setSubmitting(isSubmitting);
		}, [isSubmitting, formStore]);

		const handleSubmit = async (e: React.FormEvent) => {
			e.preventDefault();

			// Validate form
			const isValid = formStore.validateForm();
			if (!isValid) {
				return;
			}

			// Call parent submit handler
			await onSubmit();
		};

		const handleSaveDraft = async () => {
			if (onSaveDraft) {
				await onSaveDraft();
			}
		};

		const handleSectionChange = (section: string) => {
			formStore.setActiveSection(section as FormSection);
		};

		// Check if all tabs are 100% complete
		const allTabsComplete =
			formStore.caseDetailsProgress === 100 &&
			formStore.officersProgress === 100 &&
			formStore.drugBagsProgress === 100;

		return (
			<div className="space-y-6">
				{/* Multi-Section Form Tabs */}
				<Tabs
					value={formStore.activeSection}
					onValueChange={handleSectionChange}
					className="w-full"
				>
					<TabsList className="flex w-full">
						<TabsTrigger
							value="case-details"
							className="flex-1 flex items-center justify-center gap-2"
						>
							<FileText className="h-4 w-4" />
							<span className="hidden sm:inline">
								Case Details
							</span>
							<TabProgressIndicator
								progress={formStore.caseDetailsProgress}
								className="ml-2"
							/>
						</TabsTrigger>
						<TabsTrigger
							value="officers-station"
							className="flex-1 flex items-center justify-center gap-2"
						>
							<Shield className="h-4 w-4" />
							<span className="hidden sm:inline">Officers</span>
							<TabProgressIndicator
								progress={formStore.officersProgress}
								className="ml-2"
							/>
						</TabsTrigger>
						<TabsTrigger
							value="drug-bags"
							className="flex-1 flex items-center justify-center gap-2"
						>
							<Package className="h-4 w-4" />
							<span className="hidden sm:inline">Assessment</span>
							<TabProgressIndicator
								progress={formStore.drugBagsProgress}
								className="ml-2"
							/>
						</TabsTrigger>
					</TabsList>

					{/* Case Details Section (includes Defendants) */}
					<TabsContent value="case-details" className="mt-6">
						<div className="space-y-6">
							<CaseDetailsSection />
							<DefendantsSection />
						</div>
					</TabsContent>

					{/* Officers and Station Section */}
					<TabsContent value="officers-station" className="mt-6">
						<OfficersStationSection />
					</TabsContent>

					{/* Drug Bags Section */}
					<TabsContent value="drug-bags" className="mt-6">
						<DrugBagsSection />
					</TabsContent>
				</Tabs>

				{/* Form Actions */}
				<Card>
					<CardContent className="pt-6">
						<form onSubmit={handleSubmit}>
							<div className="flex items-center justify-between">
								<div className="text-sm text-muted-foreground flex flex-col">
									{!allTabsComplete && (
										<span className="text-amber-600">
											Complete all tabs (all green checkmarks)
											to create submission
										</span>
									)}
									{formStore.hasValidationErrors && (
										<span className="text-red-500">
											Please fix validation errors
										</span>
									)}
								</div>
								<div className="flex items-center gap-3">
									<Button
										type="button"
										variant="outline"
										onClick={onCancel}
										disabled={isSubmitting || isSavingDraft}
									>
										<X className="h-4 w-4 mr-2" />
										Cancel
									</Button>
									{onSaveDraft && (
										<Button
											type="button"
											variant="default"
											onClick={handleSaveDraft}
											disabled={isSavingDraft || isSubmitting}
											className="bg-blue-600 hover:bg-blue-700"
										>
											<Save className="h-4 w-4 mr-2=0.5" />
											{isSavingDraft
												? "Saving..."
												: "Save Draft"}
										</Button>
									)}
									<Button
										type="submit"
										disabled={
											!allTabsComplete ||
											isSubmitting ||
											isSavingDraft
										}
										variant="default"
										className="bg-green-600 hover:bg-green-700"
									>
										<Save className="h-4 w-4 mr-0.5" />
										{isSubmitting ? "Creating..." : "Finalise"}
									</Button>
								</div>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		);
	}
);

CreateSubmissionForm.displayName = "CreateSubmissionForm";
