import { History } from "lucide-react";
import type { Priority3Form } from "@/shared/types/backend-api.types";

interface LegacyCertificatesNoticeProps {
	/** Forms imported from the old system */
	forms: Priority3Form[];
}

const formatDate = (iso: string | null): string | null => {
	if (!iso) return null;
	const [year, month, day] = iso.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
};

/**
 * Explains why imported forms have no Generate button: the old system already
 * certified them, and those certificates may have been presented in court, so
 * the app never makes a second certificate for the same examination.
 */
export const LegacyCertificatesNotice = ({
	forms,
}: LegacyCertificatesNoticeProps) => {
	// A certificate with more than five bags was split across several forms;
	// list each old certificate once.
	const certificates = [
		...new Map(
			forms.map((f) => [
				f.legacy_certificate_number ?? "",
				formatDate(f.legacy_certified_date ?? null),
			])
		),
	];

	return (
		<div
			role="note"
			className="flex gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-900/60"
		>
			<History
				className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300"
				aria-hidden="true"
			/>
			<div className="space-y-2">
				<p className="font-medium">Certified by the old system</p>
				<ul className="space-y-0.5">
					{certificates.map(([number, date]) => (
						<li key={number}>
							Certificate {number}
							{date
								? `, certified ${date}`
								: ", certification date not recorded"}
						</li>
					))}
				</ul>
				<p className="text-muted-foreground">
					These forms were imported from the previous database. Their
					certificates were issued there and may have been presented in court,
					so no new certificate is made for them here.
				</p>
			</div>
		</div>
	);
};
