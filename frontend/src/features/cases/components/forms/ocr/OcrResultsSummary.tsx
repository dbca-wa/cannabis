import { observer } from "mobx-react-lite";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import { ocrResultStore } from "@/features/cases/stores/ocrResult.store";

/** Human-readable labels for extracted field keys. */
const FIELD_LABELS: Record<string, string> = {
	date: "Received Date",
	seizure_date: "Seizure Date",
	security_movement_envelope: "Security Movement Envelope",
	division_unit: "Division / Unit",
	defendant_name: "Defendant",
	conveying_officer_name: "Conveying Officer",
	conveying_officer_badge: "Conveying Officer Badge",
	on_behalf_of_officer_name: "On Behalf Of Officer",
	on_behalf_of_officer_badge: "On Behalf Of Officer Badge",
};

interface OcrResultsSummaryProps {
	onDismissAll: () => void;
}

export const OcrResultsSummary = observer(
	({ onDismissAll }: OcrResultsSummaryProps) => {
		const store = ocrResultStore;

		if (!store.extractionResponse || store.fieldConfidence.size === 0) {
			return null;
		}

		const entries = Array.from(store.fieldConfidence.entries());

		return (
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="text-sm">Extracted Fields</CardTitle>
						<Button variant="ghost" size="sm" onClick={onDismissAll}>
							<X className="h-4 w-4 mr-1" />
							Dismiss all
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<ul className="space-y-1">
						{entries.map(([field, confidence]) => (
							<li
								key={field}
								className="flex items-center justify-between text-sm py-1"
							>
								<span className="text-muted-foreground">
									{FIELD_LABELS[field] ?? field}
								</span>
								<span className="flex items-center gap-1">
									{confidence < 0.8 && (
										<AlertCircle className="h-3.5 w-3.5 text-amber-500" />
									)}
									<span
										className={
											confidence < 0.8
												? "text-amber-600 font-medium"
												: "text-muted-foreground"
										}
									>
										{Math.round(confidence * 100)}%
									</span>
								</span>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		);
	}
);

OcrResultsSummary.displayName = "OcrResultsSummary";
