import { useCallback, useState } from "react";
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
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCaseFormStore } from "../../../hooks/useCaseFormStore";
import { ocrResultStore } from "../../../stores/ocrResult.store";
import { OcrUploadZone } from "../ocr/OcrUploadZone";
import { OcrResultsSummary } from "../ocr/OcrResultsSummary";

export const CaseDetailsSection = observer(() => {
	const formStore = useCaseFormStore();
	const store = ocrResultStore;

	const [showReuploadConfirm, setShowReuploadConfirm] = useState(false);

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

	const handleExtracted = useCallback(() => {
		// Extraction complete — results summary will appear automatically
	}, []);

	const handleClear = useCallback(() => {
		store.clearAll();
	}, [store]);

	const handleDismissAll = useCallback(() => {
		store.clearAll();
		formStore.resetForm();
	}, [store, formStore]);

	const handleDismissError = useCallback(() => {
		store.clearAll();
	}, [store]);

	const isComplete = !!store.extractionResponse && !store.isProcessing;
	const hasError = !!store.error;
	const isHttp413 =
		store.error?.includes("413") ||
		store.error?.toLowerCase().includes("file size");

	return (
		<div className="space-y-4">
			{/* OCR Upload Zone — optional, above the form */}
			<OcrUploadZone
				onExtracted={handleExtracted}
				onClear={handleClear}
				onReuploadRequest={
					isComplete ? () => setShowReuploadConfirm(true) : undefined
				}
			/>

			{/* Unreliable extraction warning */}
			{isComplete && store.isUnreliableExtraction && (
				<Alert className="border-amber-500/50">
					<AlertTriangle className="h-4 w-4 text-amber-500" />
					<AlertDescription className="text-amber-700">
						The form could not be reliably read. We recommend entering data
						manually.
					</AlertDescription>
				</Alert>
			)}

			{/* Error banners */}
			{hasError && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription className="flex items-center justify-between">
						<span>
							{isHttp413
								? "The file exceeds the server's maximum upload size."
								: store.error}
						</span>
						<Button
							variant="ghost"
							size="sm"
							className="ml-2 h-auto p-1"
							onClick={handleDismissError}
						>
							Dismiss
						</Button>
					</AlertDescription>
				</Alert>
			)}

			{/* Extraction results summary */}
			{isComplete && <OcrResultsSummary onDismissAll={handleDismissAll} />}

			{/* Re-upload confirmation dialog */}
			<AlertDialog
				open={showReuploadConfirm}
				onOpenChange={setShowReuploadConfirm}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Replace extracted data?</AlertDialogTitle>
						<AlertDialogDescription>
							Uploading a new file will overwrite the current prefilled data.
							Any manual changes you have made will be lost.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setShowReuploadConfirm(false);
								store.clearAll();
								formStore.resetForm();
							}}
						>
							Continue
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

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
