import { useCallback, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
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
import { AlertCircle, AlertTriangle, ArrowRight, Info } from "lucide-react";
import { useOcrEnabled } from "@/shared/hooks/data";
import { useCaseFormStore } from "../../../hooks/useCaseFormStore";
import { ocrResultStore } from "../../../stores/ocrResult.store";
import { OcrUploadZone } from "./OcrUploadZone";
import { OcrResultsSummary } from "./OcrResultsSummary";

/**
 * Self-gating OCR panel: the drag-and-drop upload zone, an extraction review
 * summary (with confidence flags for comparison against the physical form), and
 * the re-upload confirmation. Renders nothing unless the OCR feature flag is on.
 *
 * Shared by the case-creation wizard, the edit form, and the process-case
 * details step so the upload experience stays consistent.
 */
export const OcrCaseDetailsPanel = observer(() => {
	const ocrEnabled = useOcrEnabled();
	const formStore = useCaseFormStore();
	const store = ocrResultStore;
	const [showReuploadConfirm, setShowReuploadConfirm] = useState(false);

	const handleExtracted = useCallback(() => {
		// Extraction complete — the results summary appears automatically.
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

	if (!ocrEnabled) return null;

	const isComplete = !!store.extractionResponse && !store.isProcessing;
	const hasError = !!store.error;
	const isHttp413 =
		store.error?.includes("413") ||
		store.error?.toLowerCase().includes("file size");
	const caseMatch = store.caseMatch;

	return (
		<div className="space-y-4">
			<OcrUploadZone
				onExtracted={handleExtracted}
				onClear={handleClear}
				onReuploadRequest={
					isComplete ? () => setShowReuploadConfirm(true) : undefined
				}
			/>

			{isComplete && caseMatch?.matched && caseMatch.case_id && (
				<Alert className="border-blue-500/50">
					<Info className="h-4 w-4 text-blue-600" />
					<AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<span className="text-blue-800">
							This police reference matches an existing case
							{caseMatch.case_number ? ` (${caseMatch.case_number})` : ""}.
						</span>
						<Button
							variant="outline"
							size="sm"
							className="shrink-0 self-start sm:self-auto"
							asChild
						>
							<Link to={`/cases/${caseMatch.case_id}`}>
								Add a form to this case
								<ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
							</Link>
						</Button>
					</AlertDescription>
				</Alert>
			)}

			{isComplete && store.isUnreliableExtraction && (
				<Alert className="border-amber-500/50">
					<AlertTriangle className="h-4 w-4 text-amber-500" />
					<AlertDescription className="text-amber-700">
						The form could not be reliably read. We recommend entering data
						manually.
					</AlertDescription>
				</Alert>
			)}

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

			{isComplete && <OcrResultsSummary onDismissAll={handleDismissAll} />}

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
		</div>
	);
});

OcrCaseDetailsPanel.displayName = "OcrCaseDetailsPanel";
