/**
 * Compact badge indicating whether a botanist has a signature on file.
 * Designed for use in table cells and user lists.
 */

import { Badge } from "@/shared/components/ui/badge";

interface SignatureStatusBadgeProps {
	/** Whether the botanist has a signature on file. Null/undefined = don't render. */
	hasSignature: boolean | null | undefined;
}

export const SignatureStatusBadge = ({
	hasSignature,
}: SignatureStatusBadgeProps) => {
	if (hasSignature == null) {
		return null;
	}

	if (hasSignature) {
		return (
			<Badge
				className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200"
				role="status"
				aria-label="Signature on file"
			>
				Signature on file
			</Badge>
		);
	}

	return (
		<Badge
			className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200"
			role="status"
			aria-label="No signature"
		>
			No signature
		</Badge>
	);
};
