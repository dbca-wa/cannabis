import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import type { DefendantTiny } from "@/shared/types/backend-api.types";
import { PrimaryDefendantSelector } from "./PrimaryDefendantSelector";
import { SecondaryDefendantSelector } from "./SecondaryDefendantSelector";
import { MergePreview } from "./MergePreview";
import { useDefendantMerge } from "../../hooks/useDefendantMerge";
import { Button } from "@/shared/components/ui/button";

export const DefendantMergePage = () => {
	useDocumentTitle("Merge Defendants");
	const [primary, setPrimary] = useState<DefendantTiny | null>(null);
	const [secondaries, setSecondaries] = useState<DefendantTiny[]>([]);
	const mergeMutation = useDefendantMerge();

	const handleMerge = async () => {
		if (!primary || secondaries.length === 0) return;

		try {
			await mergeMutation.mutateAsync({
				primary_id: primary.id,
				secondary_ids: secondaries.map((d) => d.id),
			});

			setPrimary(null);
			setSecondaries([]);
		} catch {
			// Error handled by mutation hook
		}
	};

	return (
		<div className="space-y-6 p-6">
			<Link
				to="/defendants"
				className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to Defendants
			</Link>

			<h1 className="text-2xl font-semibold">Merge Defendants</h1>

			<PrimaryDefendantSelector
				selected={primary}
				onSelect={setPrimary}
				excludeIds={secondaries.map((d) => d.id)}
			/>

			{primary && (
				<SecondaryDefendantSelector
					selected={secondaries}
					onChange={setSecondaries}
					excludeId={primary.id}
				/>
			)}

			{primary && secondaries.length > 0 && (
				<>
					<MergePreview primary={primary} secondaries={secondaries} />
					<Button
						variant="destructive"
						onClick={handleMerge}
						disabled={mergeMutation.isPending}
					>
						{mergeMutation.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						{mergeMutation.isPending ? "Merging..." : "Confirm Merge"}
					</Button>
				</>
			)}
		</div>
	);
};
