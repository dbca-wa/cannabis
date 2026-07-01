/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Loader2, Undo2, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import type { CasePhase } from "@/features/cases/types/cases.types";
import {
	PHASE_KEYS,
	PHASE_DISPLAY_NAMES,
	PHASE_BADGE_COLOURS,
} from "@/shared/constants/phases.config";

interface SendBackDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentPhase: CasePhase;
	onSubmit: (targetPhase: CasePhase, reason: string) => Promise<void>;
	isPending: boolean;
}

/**
 * Dialog for sending a case back one phase.
 *
 * The target is always the phase immediately before the case's current phase —
 * it is derived automatically (no selection needed) and shown to the user.
 * A reason is required for the audit trail.
 */
export const SendBackDialog = ({
	open,
	onOpenChange,
	currentPhase,
	onSubmit,
	isPending,
}: SendBackDialogProps) => {
	const [reason, setReason] = useState("");

	// Target is always the previous phase relative to the case's current phase
	const currentPhaseIndex = PHASE_KEYS.indexOf(currentPhase);
	const previousPhase =
		currentPhaseIndex > 0 ? PHASE_KEYS[currentPhaseIndex - 1] : null;

	useEffect(() => {
		if (open) {
			setReason("");
		}
	}, [open]);

	const canSubmit = !!previousPhase && reason.trim().length > 0 && !isPending;

	const handleSubmit = async () => {
		if (!canSubmit || !previousPhase) return;
		await onSubmit(previousPhase, reason.trim());
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
						Return this case to the previous phase. A reason is required for the
						audit trail.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Target phase (auto-derived, read-only) */}
					<div className="space-y-2">
						<Label>Sending back to</Label>
						<div className="flex items-center gap-3 rounded-md border p-3 bg-muted/50">
							<Badge
								variant="secondary"
								className={PHASE_BADGE_COLOURS[currentPhase]}
							>
								{PHASE_DISPLAY_NAMES[currentPhase]}
							</Badge>
							<ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
							{previousPhase ? (
								<Badge
									variant="secondary"
									className={PHASE_BADGE_COLOURS[previousPhase]}
								>
									{PHASE_DISPLAY_NAMES[previousPhase]}
								</Badge>
							) : (
								<span className="text-sm text-muted-foreground">
									No earlier phase available
								</span>
							)}
						</div>
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
