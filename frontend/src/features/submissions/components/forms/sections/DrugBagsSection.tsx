import { observer } from "mobx-react-lite";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Plus, Package } from "lucide-react";
import { useSubmissionFormStore } from "../../../hooks/useSubmissionFormStore";
import { DrugBagFormItem } from "../DrugBagFormItem";
import Calendar22 from "@/shared/components/ui/calendar-22";

export const DrugBagsSection = observer(() => {
	const formStore = useSubmissionFormStore();

	const handleAddBag = () => {
		formStore.addDrugBag();
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Botanical Assessment</CardTitle>
				<CardDescription>
					Record assessment details and manage drug bags
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Assessment Date - Shared across all bags */}
				<div className="space-y-2 pb-4 border-b">
					<Label htmlFor="assessment_date" className="required">
						Assessment Date
					</Label>
					<Calendar22
						value={formStore.formData.assessment_date}
						onChange={(date) =>
							formStore.updateField("assessment_date", date)
						}
						placeholder="Select assessment date"
					/>
					<p className="text-xs text-muted-foreground">
						Date of botanical assessment (defaults to received date
						or today)
					</p>
				</div>

				{/* Additional Notes - Section (c) - REQUIRED */}
				<div className="space-y-2 pb-4">
					<label
						htmlFor="botanical_notes"
						className="text-sm font-medium required"
					>
						Additional Notes (Section C)
					</label>
					<textarea
						id="botanical_notes"
						value={
							formStore.formData.bags[0]?.botanist_notes ||
							formStore.getAutoPopulatedAdditionalNotes()
						}
						onChange={(e) => {
							// Update first bag's botanist_notes (shared across all bags)
							if (formStore.formData.bags.length > 0) {
								formStore.updateDrugBag(0, {
									botanist_notes: e.target.value,
								});
							}
						}}
						placeholder={formStore.getAutoPopulatedAdditionalNotes()}
						className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md resize-y"
					/>
					<p className="text-xs text-muted-foreground">
						Auto-populated with subsample information. Edit as
						needed. This will appear in section (c) of the
						certificate.
					</p>
				</div>

				{/* Drug Bags Section */}
				<div className="space-y-4 pt-4 border-t">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-lg font-medium">Drug Bags</h3>
							<p className="text-sm text-muted-foreground">
								Add and manage drug bags for this submission
							</p>
						</div>
						<Button
							type="button"
							onClick={handleAddBag}
							size="sm"
							variant="outline"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Bag
						</Button>
					</div>

					{formStore.formData.bags.length === 0 ? (
						<div className="p-8 border border-dashed rounded-lg text-center">
							<Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-sm text-muted-foreground mb-4">
								No drug bags added yet. Click "Add Bag" to start
								adding bags.
							</p>
							<Button
								type="button"
								onClick={handleAddBag}
								variant="outline"
							>
								<Plus className="h-4 w-4 mr-2" />
								Add First Bag
							</Button>
						</div>
					) : (
						<div className="space-y-4">
							{formStore.formData.bags.map((bag, index) => (
								<DrugBagFormItem
									key={index}
									bag={bag}
									index={index}
									onUpdate={(data) =>
										formStore.updateDrugBag(index, data)
									}
									onRemove={() =>
										formStore.removeDrugBag(index)
									}
									validationErrors={
										formStore.validationErrors
									}
								/>
							))}
						</div>
					)}
				</div>

				{formStore.formData.bags.length > 0 && (
					<div className="pt-4">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								Total Bags:
							</span>
							<span className="font-medium">
								{formStore.totalBags}
							</span>
						</div>
					</div>
				)}

				{/* Internal Comments - Optional, at bottom */}
				<div className="space-y-2 pt-4 border-t">
					<label
						htmlFor="internal_comments"
						className="text-sm font-medium"
					>
						Internal Comments (Optional)
					</label>
					<textarea
						id="internal_comments"
						value={formStore.formData.internal_comments}
						onChange={(e) =>
							formStore.updateField(
								"internal_comments",
								e.target.value
							)
						}
						placeholder="Add any internal notes or comments (not shown on certificate)..."
						className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md resize-y"
					/>
					<p className="text-xs text-muted-foreground">
						Optional notes for internal use only (not shown on
						certificate)
					</p>
				</div>
			</CardContent>
		</Card>
	);
});

DrugBagsSection.displayName = "DrugBagsSection";
