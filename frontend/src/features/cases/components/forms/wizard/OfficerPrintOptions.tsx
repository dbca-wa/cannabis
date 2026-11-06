import { Checkbox } from "@/shared/components/ui/checkbox";
import { useOfficerById } from "@/features/police/hooks";
import { hasRecordedRank } from "@/features/cases/utils/certificateWording";

interface PrintOptionProps {
	id: string;
	checked: boolean;
	disabled: boolean;
	label: string;
	onChange: (checked: boolean) => void;
}

const PrintOption = ({
	id,
	checked,
	disabled,
	label,
	onChange,
}: PrintOptionProps) => (
	<div className="flex items-center gap-2">
		<Checkbox
			id={id}
			checked={disabled ? false : checked}
			disabled={disabled}
			onCheckedChange={(value) => onChange(value === true)}
			className="cursor-pointer"
		/>
		<label
			htmlFor={id}
			className={
				disabled
					? "text-sm text-muted-foreground"
					: "text-sm cursor-pointer select-none"
			}
		>
			{label}
		</label>
	</div>
);

interface OfficerPrintOptionsProps {
	/** Which officer these options belong to. */
	role: "conveying" | "requesting";
	officerId: number | null;
	/** Prefix for the checkbox ids, so the same options can appear twice. */
	idPrefix: string;
	printStation: boolean;
	onPrintStationChange: (checked: boolean) => void;
	/** Requesting officer only. */
	printRank?: boolean;
	onPrintRankChange?: (checked: boolean) => void;
}

/**
 * Per-case certificate print options shown under an officer: whether their
 * station prints and, for the requesting officer, whether their recorded rank
 * replaces "Sworn Officer". Each label says what would print. An option the
 * officer's record cannot satisfy is disabled and says why; its stored value is
 * kept so it applies again if the record gains a station or rank. Nothing here
 * blocks the step.
 */
export const OfficerPrintOptions = ({
	role,
	officerId,
	idPrefix,
	printStation,
	onPrintStationChange,
	printRank = false,
	onPrintRankChange,
}: OfficerPrintOptionsProps) => {
	const { data: fetched } = useOfficerById(officerId);
	// Only trust the fetched record once it is for the chosen officer.
	const officer = officerId && fetched?.id === officerId ? fetched : null;
	if (!officerId || !officer) return null;

	const stationName = officer.station_details?.name ?? "";
	const rankRecorded = hasRecordedRank(officer.rank);

	return (
		<div className="space-y-1.5 pl-1" data-testid={`${idPrefix}-print-options`}>
			<PrintOption
				id={`${idPrefix}-print-station`}
				checked={printStation}
				disabled={!stationName}
				label={
					stationName
						? `Print station on the certificate (${stationName})`
						: "No station on record, so none prints"
				}
				onChange={onPrintStationChange}
			/>
			{role === "requesting" && onPrintRankChange && (
				<PrintOption
					id={`${idPrefix}-print-rank`}
					checked={printRank}
					disabled={!rankRecorded}
					label={
						rankRecorded
							? `Print rank instead of Sworn Officer (${officer.rank_display})`
							: "No rank on record, so Sworn Officer prints"
					}
					onChange={onPrintRankChange}
				/>
			)}
		</div>
	);
};
