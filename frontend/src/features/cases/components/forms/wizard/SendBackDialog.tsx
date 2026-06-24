/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import type { CasePhase } from "@/features/cases/types/cases.types";
import {
	PHASE_KEYS,
	PHASE_DISPLAY_NAMES,
} from "@/shared/constants/phases.config";

interface SendBackDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentPhase: CasePhase;
	onSubmit: (targetPhase: CasePhase, reason: string) => Promise<void>;
	isPending: boolean;
}

/**
 * Dialog for sending a case back to an earlier phase.
 * Collects a target phase and a required reason before submitting.
 */
export const SendBackDialog = ({
	open,
	onOpenChange,
	currentPhase,
	onSubmit,
	isPending,
}: SendBackDialogProps) => {
	const [selectedPhase, setSelectedPhase] = useState<CasePhase | "">("");
	const [reason, setReason] = useState("");

	// Reset form state when dialog opens — auto-select the previous phase
	const currentPhaseIndex = PHASE_KEYS.indexOf(currentPhase);
	const previousPhase =
		currentPhaseIndex > 0 ? PHASE_KEYS[currentPhaseIndex - 1] : null;

	useEffect(() => {
		if (open) {
			setSelectedPhase(previousPhase ?? "");
			setReason("");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const availablePhases = previousPhase ? [previousPhase] : [];

	const canSubmit = !!selectedPhase && reason.trim().length > 0 && !isPending;

	const handleSubmit = async () => {
		if (!canSubmit || !selectedPhase) return;
		await onSubmit(selectedPhase as CasePhase, reason.trim());
	};

	return (
		<Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
			<DialogContent
				className="sm:max-w-[500px]"
				onInteractOutside={(e) => {
					if (isPending) e.preventDefault();
				}}
				onEscapeKeyDown={(e) => {
					if (isPending) e.preventDefault();
				}}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Undo2 className="h-5 w-5" />
						Send Case Back
					</DialogTitle>
					<DialogDescription>
						Return this case to an earlier phase. A reason is required for the
						audit trail.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Phase selector */}
					<div className="space-y-2">
						<Label htmlFor="send-back-phase">Target Phase</Label>
						<Select
							value={selectedPhase}
							onValueChange={(value) => setSelectedPhase(value as CasePhase)}
						>
							<SelectTrigger id="send-back-phase">
								<SelectValue placeholder="Select a phase to send back to..." />
							</SelectTrigger>
							<SelectContent>
								{availablePhases.map((phase) => (
									<SelectItem key={phase} value={phase}>
										{PHASE_DISPLAY_NAMES[phase]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Reason textarea */}
					<div className="space-y-2">
						<Label htmlFor="send-back-reason">Reason</Label>
						<Textarea
							id="send-back-reason"
							placeholder="Explain why this case needs to be sent back..."
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							rows={4}
							disabled={isPending}
						/>
						{reason.length > 0 && reason.trim() === "" && (
							<p className="text-sm text-red-600">
								Reason cannot be only whitespace
							</p>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!canSubmit}
						className="bg-red-600 hover:bg-red-700 text-white"
					>
						{isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Undo2 className="mr-2 h-4 w-4" />
						)}
						{isPending ? "Sending Back..." : "Send Back"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
