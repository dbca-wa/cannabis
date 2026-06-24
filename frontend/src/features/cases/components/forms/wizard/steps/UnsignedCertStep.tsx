import { FileCheck, Loader2 } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "../SectionCard";

interface UnsignedCertStepProps {
	/** Case data from TanStack Query — contains certificate_number if generated */
	caseData: Record<string, unknown> | null;
	/** Callback to trigger workflow actions (e.g. "generate_certificate") */
	onAction: (action: string) => void;
}

/**
 * Unsigned Certificate step — triggers PDF generation for the case certificate.
 * Displays generation status and certificate number once complete.
 */
export const UnsignedCertStep = ({
	caseData,
	onAction,
}: UnsignedCertStepProps) => {
	const certificateNumber =
		typeof caseData?.certificate_number === "string"
			? caseData.certificate_number
			: null;

	const hasCertificate = !!certificateNumber;
	const isGenerating = caseData?.is_generating_certificate === true;

	return (
		<div className="space-y-6">
			<SectionCard
				title="Unsigned Certificate"
				isComplete={hasCertificate}
				isInvalid={false}
			>
				{hasCertificate ? (
					<div className="flex items-center gap-3">
						<FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
						<span className="text-sm font-medium">Certificate generated ✓</span>
						<Badge variant="secondary">{certificateNumber}</Badge>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
						<FileCheck className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="mb-4 text-sm text-muted-foreground">
							Generate the unsigned certificate PDF for this case. The
							certificate will be available for botanist review once generated.
						</p>
						<Button
							type="button"
							onClick={() => onAction("generate_certificate")}
							disabled={isGenerating}
						>
							{isGenerating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Generating…
								</>
							) : (
								<>
									<FileCheck className="mr-2 h-4 w-4" />
									Generate Certificate
								</>
							)}
						</Button>
					</div>
				)}
			</SectionCard>
		</div>
	);
};
