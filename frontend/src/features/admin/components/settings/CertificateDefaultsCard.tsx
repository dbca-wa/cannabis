import { FileBadge } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";

export type CertificateDefaultField =
	| "default_print_conveying_station"
	| "default_print_requesting_station"
	| "default_print_requesting_rank";

const OPTIONS: {
	field: CertificateDefaultField;
	label: string;
	description: string;
}[] = [
	{
		field: "default_print_conveying_station",
		label: "Conveying officer's station",
		description:
			'Prints "of <station>" after the conveying officer when they have one on record.',
	},
	{
		field: "default_print_requesting_station",
		label: "Requesting officer's station",
		description:
			'Prints "of <station>" after the requesting officer when they have one on record.',
	},
	{
		field: "default_print_requesting_rank",
		label: "Requesting officer's rank",
		description:
			'Prints the requesting officer\'s recorded rank, such as Senior Constable, instead of "Sworn Officer". Officers with no rank on record still print as Sworn Officer.',
	},
];

interface CertificateDefaultsCardProps {
	values: Record<CertificateDefaultField, boolean>;
	isSaving: boolean;
	onChange: (field: CertificateDefaultField, value: boolean) => void;
	/** Show the defaults without letting them be changed. */
	readOnly?: boolean;
}

/**
 * The certificate print options pre-ticked on each new case. Each case can
 * still change its own options; changing a default never alters existing
 * cases. The conveying officer always prints as "Unsworn Officer".
 */
export const CertificateDefaultsCard = ({
	values,
	isSaving,
	onChange,
	readOnly = false,
}: CertificateDefaultsCardProps) => (
	<Card className="p-6">
		<div className="mb-5 flex items-start gap-3">
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
				<FileBadge className="h-5 w-5" />
			</div>
			<div>
				<h3>Certificate defaults</h3>
				<p className="text-[13px] text-muted-foreground">
					Pre-ticked on each new case. Every case can change its own options,
					and changing these never alters existing cases.
				</p>
			</div>
		</div>

		<div className="space-y-4">
			{OPTIONS.map((option) => (
				<div key={option.field} className="flex items-start gap-4">
					<div className="flex-1">
						<label
							htmlFor={option.field}
							className="text-[14px] font-medium cursor-pointer"
						>
							{option.label}
						</label>
						<p className="text-[12px] text-muted-foreground mt-0.5">
							{option.description}
						</p>
					</div>
					<Switch
						id={option.field}
						checked={values[option.field]}
						disabled={isSaving || readOnly}
						onCheckedChange={(checked) => onChange(option.field, checked)}
						className="data-[state=checked]:bg-emerald-600"
					/>
				</div>
			))}
		</div>
	</Card>
);
