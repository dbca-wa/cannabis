import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
	FileText,
	Upload,
	Loader2,
	AlertCircle,
	ExternalLink,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOcrEnabled } from "@/shared/hooks/data";
import { uploadPoliceForm } from "../../../services/ocr.service";
import { formatFileSize } from "@/shared/utils/number.utils";

const ACCEPTED_MIME_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/tiff",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.tiff,.tif";

interface CasePoliceFormUploadProps {
	caseId: number;
	/** Current stored form URL, if any. */
	currentFormUrl?: string | null;
	/** Whether the controls should be disabled (e.g. completed, non-admin). */
	disabled?: boolean;
}

/**
 * View and replace the stored Priority 3 police form for an existing case.
 * Used on the process-case details step. Self-gates on the OCR feature flag.
 */
export const CasePoliceFormUpload = ({
	caseId,
	currentFormUrl,
	disabled = false,
}: CasePoliceFormUploadProps) => {
	const ocrEnabled = useOcrEnabled();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [formUrl, setFormUrl] = useState<string | null>(currentFormUrl ?? null);
	const [validationError, setValidationError] = useState<string | null>(null);

	const uploadMutation = useMutation({
		mutationFn: (file: File) => uploadPoliceForm(caseId, file),
		onSuccess: (data) => {
			setFormUrl(data.police_form_url);
			toast.success("Police form updated");
		},
		onError: (error: Error) => {
			toast.error("Failed to upload police form", {
				description: error.message?.includes("<") ? undefined : error.message,
			});
		},
	});

	const handleFile = useCallback(
		(file: File) => {
			setValidationError(null);
			if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
				setValidationError(
					`Unsupported file type "${file.type}". Accepted: PDF, PNG, JPEG, TIFF.`
				);
				return;
			}
			if (file.size > MAX_FILE_SIZE) {
				setValidationError(
					`File size (${formatFileSize(file.size)}) exceeds the 20 MB limit.`
				);
				return;
			}
			uploadMutation.mutate(file);
		},
		[uploadMutation]
	);

	if (!ocrEnabled) return null;

	return (
		<Card>
			<CardContent className="py-4 space-y-3">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 min-w-0">
						<FileText className="h-4 w-4 text-muted-foreground shrink-0" />
						<span className="text-sm font-medium">Priority 3 Form</span>
						{formUrl ? (
							<a
								href={formUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-emerald-600 hover:underline inline-flex items-center gap-1"
							>
								View <ExternalLink className="h-3 w-3" />
							</a>
						) : (
							<span className="text-xs text-muted-foreground">
								— none stored
							</span>
						)}
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || uploadMutation.isPending}
						onClick={() => fileInputRef.current?.click()}
					>
						{uploadMutation.isPending ? (
							<Loader2 className="h-4 w-4 mr-1 animate-spin" />
						) : (
							<Upload className="h-4 w-4 mr-1" />
						)}
						{formUrl ? "Replace" : "Upload"}
					</Button>
				</div>

				{validationError && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{validationError}</AlertDescription>
					</Alert>
				)}

				<input
					ref={fileInputRef}
					type="file"
					accept={ACCEPTED_EXTENSIONS}
					className="hidden"
					aria-label="Select police form file"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) handleFile(file);
						if (fileInputRef.current) fileInputRef.current.value = "";
					}}
				/>
			</CardContent>
		</Card>
	);
};
