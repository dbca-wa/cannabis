import { useCallback } from "react";
import Calendar22 from "@/shared/components/ui/calendar-22";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { observer } from "mobx-react-lite";
import { useCaseFormStore } from "../../../hooks/useCaseFormStore";
import { ocrResultStore } from "../../../stores/ocrResult.store";
import { OcrCaseDetailsPanel } from "../ocr/OcrCaseDetailsPanel";

export const CaseDetailsSection = observer(() => {
	const formStore = useCaseFormStore();
	const store = ocrResultStore;

	const handleFieldChange = useCallback(
		(field: string, value: string) => {
			formStore.updateField(field as keyof typeof formStore.formData, value);
			store.clearFieldConfidence(field);
		},
		[formStore, store]
	);

	const getFieldError = (field: string): string | undefined => {
		return formStore.validationErrors[field] as string | undefined;
	};

	return (
		<div className="space-y-4">
			{/* OCR upload + review (only when the OCR feature flag is enabled) */}
			<OcrCaseDetailsPanel />

			<Card>
				<CardHeader>
					<CardTitle>Case Details</CardTitle>
					<CardDescription>
						Enter the basic information about this case
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Police Reference No. */}
					<div className="space-y-2">
						<Label htmlFor="case_number" className="required">
							Police Reference No.
						</Label>
						<Input
							id="case_number"
							value={formStore.formData.case_number}
							onChange={(e) => handleFieldChange("case_number", e.target.value)}
							placeholder="Enter police reference number"
							className={getFieldError("case_number") ? "border-red-500" : ""}
						/>
						{getFieldError("case_number") && (
							<p className="text-sm text-red-500">
								{getFieldError("case_number")}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Police reference number for this case
						</p>
					</div>

					{/* Received Date */}
					<div className="space-y-2">
						<Label htmlFor="received" className="required">
							Received Date
						</Label>
						<Calendar22
							value={formStore.formData.received}
							onChange={(date) => handleFieldChange("received", date)}
							placeholder="Select received date"
							error={!!getFieldError("received")}
						/>
						{getFieldError("received") && (
							<p className="text-sm text-red-500">
								{getFieldError("received")}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Date when the case was received (time defaults to 9:00 AM)
						</p>
					</div>

					{/* Security Movement Envelope */}
					<div className="space-y-2">
						<Label htmlFor="security_movement_envelope" className="required">
							Security Movement Envelope Number
						</Label>
						<Input
							id="security_movement_envelope"
							value={formStore.formData.security_movement_envelope}
							onChange={(e) =>
								handleFieldChange("security_movement_envelope", e.target.value)
							}
							placeholder="Enter envelope number"
							className={
								getFieldError("security_movement_envelope")
									? "border-red-500"
									: ""
							}
						/>
						{getFieldError("security_movement_envelope") && (
							<p className="text-sm text-red-500">
								{getFieldError("security_movement_envelope")}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Security envelope tracking number
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
});

CaseDetailsSection.displayName = "CaseDetailsSection";
