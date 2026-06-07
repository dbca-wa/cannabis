import { AlertTriangle } from "lucide-react";
import type { DefendantTiny } from "@/shared/types/backend-api.types";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";

interface MergePreviewProps {
	primary: DefendantTiny;
	secondaries: DefendantTiny[];
}

export const MergePreview = ({ primary, secondaries }: MergePreviewProps) => {
	return (
		<div className="space-y-4 rounded-lg border p-4">
			<div>
				<p className="text-sm font-medium text-muted-foreground">
					Primary (will be kept):
				</p>
				<p className="text-base font-semibold">{primary.full_name}</p>
			</div>

			<div>
				<p className="text-sm font-medium text-muted-foreground">
					Will be merged and deleted:
				</p>
				<ul className="mt-1 space-y-1">
					{secondaries.map((defendant) => (
						<li key={defendant.id} className="text-sm">
							{defendant.full_name}{" "}
							<span className="text-muted-foreground">
								({defendant.cases_count}{" "}
								{defendant.cases_count === 1 ? "case" : "cases"})
							</span>
						</li>
					))}
				</ul>
			</div>

			<Alert variant="destructive">
				<AlertTriangle className="h-4 w-4" />
				<AlertTitle>Warning</AlertTitle>
				<AlertDescription>
					This action cannot be undone. The secondary defendants will be
					permanently deleted.
				</AlertDescription>
			</Alert>
		</div>
	);
};
