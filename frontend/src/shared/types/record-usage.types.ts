/**
 * Where an officer, station or defendant is used, shown before deleting it so
 * the user can see which cases will change and choose a replacement.
 */

/** A case that names the record being deleted. */
export interface AffectedCase {
	id: number;
	case_number: string;
	/** How the case uses the record, e.g. "conveying", "requesting". */
	roles: string[];
	status: string;
	status_display: string;
	is_complete: boolean;
}

export interface RecordUsage {
	cases: AffectedCase[];
	/** Officers based at a station (stations only). */
	officers?: { id: number; full_name: string }[];
}
