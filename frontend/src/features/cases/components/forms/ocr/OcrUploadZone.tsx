import { useCallback, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
	Upload,
	FileText,
	X,
	Loader2,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import { ocrResultStore } from "@/features/cases/stores/ocrResult.store";
import { useOcrUpload } from "@/features/cases/hooks/useOcrUpload";

const ACCEPTED_MIME_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/tiff",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.tiff,.tif";

/** Format bytes into a human-readable string. */
const formatFileSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface OcrUploadZoneProps {
	onExtracted: () => void;
	onClear: () => void;
	/** Called when user wants to re-upload while data exists. Parent shows confirmation dialog. */
	onReuploadRequest?: () => void;
}

export const OcrUploadZone = observer(
	({ onExtracted, onClear, onReuploadRequest }: OcrUploadZoneProps) => {
		const fileInputRef = useRef<HTMLInputElement>(null);
		const [dragOver, setDragOver] = useState(false);
		const [validationError, setValidationError] = useState<string | null>(null);
		const [selectedFile, setSelectedFile] = useState<File | null>(null);

		const { mutate: uploadFile } = useOcrUpload();

		const store = ocrResultStore;
		const isProcessing = store.isProcessing;
		const isComplete = !!store.extractionResponse && !isProcessing;
		const hasError = !!store.error;

		const validateFile = useCallback((file: File): string | null => {
			if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
				return `Unsupported file type "${file.type}". Accepted formats: PDF, PNG, JPEG, TIFF.`;
			}
			if (file.size > MAX_FILE_SIZE) {
				return `File size (${formatFileSize(file.size)}) exceeds the 20 MB limit.`;
			}
			return null;
		}, []);

		const handleFile = useCallback(
			(file: File) => {
				setValidationError(null);
				const error = validateFile(file);
				if (error) {
					setValidationError(error);
					return;
				}
				setSelectedFile(file);
			},
			[validateFile]
		);

		const handleUpload = useCallback(() => {
			if (!selectedFile) return;
			uploadFile(selectedFile, {
				onSuccess: () => {
					onExtracted();
					setSelectedFile(null);
				},
			});
		}, [selectedFile, uploadFile, onExtracted]);

		const handleDrop = useCallback(
			(e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault();
				setDragOver(false);
				const file = e.dataTransfer.files[0];
				if (file) handleFile(file);
			},
			[handleFile]
		);

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const file = e.target.files?.[0];
				if (file) handleFile(file);
				if (fileInputRef.current) fileInputRef.current.value = "";
			},
			[handleFile]
		);

		const handleRemoveFile = useCallback(() => {
			setSelectedFile(null);
			setValidationError(null);
		}, []);

		const handleClear = useCallback(() => {
			setSelectedFile(null);
			setValidationError(null);
			onClear();
		}, [onClear]);

		const handleRetry = useCallback(() => {
			store.clearAll();
			fileInputRef.current?.click();
		}, [store]);

		const openFilePicker = useCallback(() => {
			fileInputRef.current?.click();
		}, []);

		// Processing state
		if (isProcessing) {
			return (
				<Card>
					<CardContent className="flex items-center justify-center gap-3 py-8">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						<span className="text-sm text-muted-foreground">
							Extracting data from form…
						</span>
					</CardContent>
				</Card>
			);
		}

		// Complete state — collapsed summary
		if (isComplete) {
			return (
				<Card>
					<CardContent className="flex items-center justify-between py-4">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-green-600" />
							<span className="text-sm font-medium">
								{store.uploadedFileName}
							</span>
							<span className="text-xs text-muted-foreground">
								— data extracted
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={onReuploadRequest ?? openFilePicker}
							>
								Re-upload
							</Button>
							<Button variant="ghost" size="sm" onClick={handleClear}>
								<X className="h-4 w-4 mr-1" />
								Clear
							</Button>
						</div>
					</CardContent>
				</Card>
			);
		}

		// Error state
		if (hasError) {
			return (
				<Card>
					<CardContent className="py-4 space-y-3">
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{store.error}</AlertDescription>
						</Alert>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleRetry}>
								Try again
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => store.clearAll()}
							>
								Enter manually
							</Button>
						</div>
					</CardContent>
				</Card>
			);
		}

		// File selected — show name, size, upload/remove buttons
		if (selectedFile) {
			return (
				<Card>
					<CardContent className="py-4 space-y-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<FileText className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm font-medium">{selectedFile.name}</span>
								<span className="text-xs text-muted-foreground">
									({formatFileSize(selectedFile.size)})
								</span>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleRemoveFile}
								aria-label="Remove selected file"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
						<Button size="sm" onClick={handleUpload}>
							<Upload className="h-4 w-4 mr-1" />
							Extract data
						</Button>
					</CardContent>
				</Card>
			);
		}

		// Idle state — drop zone
		return (
			<Card>
				<CardContent className="py-4">
					{validationError && (
						<Alert variant="destructive" className="mb-3">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{validationError}</AlertDescription>
						</Alert>
					)}
					<div
						role="button"
						tabIndex={0}
						aria-label="Upload police form. Drop a file here or click to browse."
						className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
							dragOver
								? "border-primary bg-primary/5"
								: "border-muted-foreground/25 hover:border-primary/50"
						}`}
						onDragOver={(e) => {
							e.preventDefault();
							setDragOver(true);
						}}
						onDragLeave={() => setDragOver(false)}
						onDrop={handleDrop}
						onClick={openFilePicker}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								openFilePicker();
							}
						}}
					>
						<Upload className="h-8 w-8 text-muted-foreground" />
						<p className="text-sm font-medium">Upload police form</p>
						<p className="text-xs text-muted-foreground">
							PDF, PNG, JPEG, or TIFF — up to 20 MB
						</p>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept={ACCEPTED_EXTENSIONS}
						className="hidden"
						onChange={handleInputChange}
						aria-label="Select police form file"
					/>
				</CardContent>
			</Card>
		);
	}
);

OcrUploadZone.displayName = "OcrUploadZone";
