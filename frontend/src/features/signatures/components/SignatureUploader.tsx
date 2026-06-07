/**
 * File upload component for digital signature images.
 * Accepts PNG and SVG files with client-side validation
 * for file type and size before uploading.
 */

import { useRef, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useUploadSignature } from "../hooks";

const ACCEPTED_TYPES = ["image/png", "image/svg+xml"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

interface SignatureUploaderProps {
	/** Optional callback invoked after a successful upload. */
	onUploadComplete?: () => void;
}

export const SignatureUploader = ({
	onUploadComplete,
}: SignatureUploaderProps) => {
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const uploadMutation = useUploadSignature();

	const inputId = "signature-file-input";
	const errorId = "signature-upload-error";

	const validateFile = (file: File): string | null => {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			return "Only PNG and SVG files are accepted.";
		}
		if (file.size > MAX_FILE_SIZE) {
			return "File size must not exceed 2 MB.";
		}
		return null;
	};

	const clearInput = () => {
		if (inputRef.current) {
			inputRef.current.value = "";
		}
	};

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setError(null);
		const file = event.target.files?.[0];
		if (!file) return;

		const validationError = validateFile(file);
		if (validationError) {
			setError(validationError);
			clearInput();
			return;
		}

		const formData = new FormData();
		formData.append("image", file);

		try {
			await uploadMutation.mutateAsync(formData);
			clearInput();
			onUploadComplete?.();
		} catch {
			// Mutation hook handles toast errors via onError
			clearInput();
		}
	};

	return (
		<div className="space-y-2">
			<label htmlFor={inputId} className="text-sm font-medium">
				Upload signature image
			</label>
			<div className="flex items-center gap-2">
				<Input
					id={inputId}
					ref={inputRef}
					type="file"
					accept="image/png,image/svg+xml"
					onChange={handleFileChange}
					disabled={uploadMutation.isPending}
					aria-describedby={error ? errorId : undefined}
					aria-invalid={error ? true : undefined}
					className="flex-1"
				/>
				{uploadMutation.isPending && (
					<Button variant="ghost" size="sm" disabled>
						Uploading…
					</Button>
				)}
			</div>
			{error && (
				<p id={errorId} role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</div>
	);
};
