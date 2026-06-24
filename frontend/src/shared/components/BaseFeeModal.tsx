import { useState, useEffect, useCallback } from "react";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface BaseFeeModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	rateKey: string;
	currentValue: string;
	label: string;
	onSave: (value: string) => Promise<void>;
	isSaving?: boolean;
}

/** Validates a rate value against accepted range and format. */
const validateRate = (value: string): string | null => {
	if (value.trim() === "") {
		return "A value is required.";
	}

	// Reject non-numeric input (allows digits, one decimal point, leading minus)
	if (!/^\d+(\.\d+)?$/.test(value.trim())) {
		return "Value must be a valid number.";
	}

	const parsed = parseFloat(value);

	if (isNaN(parsed)) {
		return "Value must be a valid number.";
	}

	if (parsed < 0.01) {
		return "Value must be at least 0.01.";
	}

	if (parsed > 999_999.99) {
		return "Value must be no more than 999,999.99.";
	}

	// Check decimal places — at most 2
	const parts = value.trim().split(".");
	if (parts.length === 2 && parts[1].length > 2) {
		return "Value must have at most 2 decimal places.";
	}

	return null;
};

export const BaseFeeModal = ({
	open,
	onOpenChange,
	rateKey,
	currentValue,
	label,
	onSave,
	isSaving = false,
}: BaseFeeModalProps) => {
	const [inputValue, setInputValue] = useState(currentValue);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [apiError, setApiError] = useState<string | null>(null);

	// Reset internal state when the modal opens with a new value
	useEffect(() => {
		if (open) {
			setInputValue(currentValue);
			setValidationError(null);
			setApiError(null);
		}
	}, [open, currentValue]);

	const handleInputChange = useCallback((value: string) => {
		setInputValue(value);
		setApiError(null);
		// Validate on each change for immediate feedback
		const error = validateRate(value);
		setValidationError(error);
	}, []);

	const handleSave = useCallback(async () => {
		const error = validateRate(inputValue);
		if (error) {
			setValidationError(error);
			return;
		}

		try {
			setApiError(null);
			await onSave(inputValue.trim());
		} catch (err) {
			// Keep modal open with value preserved so user can retry
			const message =
				err instanceof Error ? err.message : "Save failed. Please try again.";
			setApiError(message);
		}
	}, [inputValue, onSave]);

	const handleDismiss = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				// Closing without saving — no side effects
				onOpenChange(false);
			}
		},
		[onOpenChange]
	);

	const isInvalid = validationError !== null;
	const inputId = `rate-input-${rateKey}`;
	const errorId = `rate-error-${rateKey}`;

	return (
		<Dialog open={open} onOpenChange={handleDismiss}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Update {label}</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor={inputId}>Rate value</Label>
					<Input
						id={inputId}
						type="number"
						step="0.01"
						min="0.01"
						max="999999.99"
						className="mt-1.5"
						value={inputValue}
						onChange={(e) => handleInputChange(e.target.value)}
						aria-invalid={isInvalid || !!apiError}
						aria-describedby={isInvalid || apiError ? errorId : undefined}
					/>
					{validationError && (
						<p id={errorId} className="text-sm text-red-600" role="alert">
							{validationError}
						</p>
					)}
					{apiError && !validationError && (
						<p id={errorId} className="text-sm text-red-600" role="alert">
							{apiError}
						</p>
					)}
				</div>
				<DialogFooter>
					<Button
						variant="ghost"
						className="cursor-pointer"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}
					>
						Cancel
					</Button>
					<Button
						className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
						onClick={handleSave}
						disabled={isInvalid || isSaving}
					>
						{isSaving ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export { validateRate };
export type { BaseFeeModalProps };
