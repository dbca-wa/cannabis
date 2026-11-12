import { Check, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { Priority3Form } from "@/shared/types/backend-api.types";
import {
	nextCertificateAction,
	useCaseCertificates,
} from "../../../hooks/useCaseCertificates";

interface CertificateBulkActionProps {
	caseId: number;
	/** All forms on the case */
	forms: Priority3Form[];
	/** True when the user may not change this case's certificates */
	locked?: boolean;
	lockMessage?: string;
}

/**
 * The next step for all of a case's certificates, beside Finalise Case:
 * Generate All while any is missing, Regenerate All while any is out of date,
 * then Mark All Ready. Disabled once every form is marked ready.
 */
export const CertificateBulkAction = ({
	caseId,
	forms,
	locked = false,
	lockMessage,
}: CertificateBulkActionProps) => {
	const {
		generateAll,
		regenerateAll,
		markAllReady,
		isGenerating,
		isMarkingAllReady,
	} = useCaseCertificates(caseId);
	const action = nextCertificateAction(forms);
	const eligible = forms.filter((f) => (f.bags?.length ?? 0) > 0);
	const missingCount = eligible.filter(
		(f) => !f.certificate?.pdf_url && !f.certificate?.pdf_file
	).length;
	const anyBatched = eligible.some((f) => f.certificate?.batch_id != null);
	const busy = isGenerating || isMarkingAllReady;

	const noBags = eligible.length === 0;
	const blockedReason = locked
		? lockMessage
		: noBags
			? "Add a drug bag to a form before generating certificates"
			: action === "regenerate" && anyBatched
				? "Certificates are batched. Use Re-package on the batch in Batches to rebuild them."
				: action === null
					? "Every certificate is up to date and marked ready"
					: undefined;
	const disabled = busy || blockedReason !== undefined;

	const icon = busy ? (
		<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
	) : action === "generate" || noBags ? (
		<FileText className="mr-2 h-4 w-4" aria-hidden="true" />
	) : action === "regenerate" ? (
		<RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
	) : (
		<Check className="mr-2 h-4 w-4" aria-hidden="true" />
	);

	const label = noBags
		? "Generate All"
		: action === "generate"
			? `Generate All (${missingCount})`
			: action === "regenerate"
				? "Regenerate All"
				: "Mark All Ready";

	const handleClick = () => {
		if (action === "generate") void generateAll();
		else if (action === "regenerate") void regenerateAll();
		else if (action === "markReady") markAllReady();
	};

	return (
		<Button
			type="button"
			size="lg"
			variant="outline"
			onClick={handleClick}
			disabled={disabled}
			title={blockedReason}
			className="min-h-11"
		>
			{icon}
			{label}
		</Button>
	);
};
