/** Legacy import tasks on the Settings page (maintainers only). */

export type LegacyImportAction = "dry_run" | "import" | "reconcile" | "undo";

export type LegacyImportStatus =
	"running" | "succeeded" | "problems" | "failed";

export interface LegacyImportBundle {
	id: number;
	filename: string;
	size: number;
	sha256: string;
	summary: {
		built_at?: string;
		source_rows?: number;
		has_csv?: boolean;
		exceptions?: number;
	};
	uploaded_by: string | null;
	uploaded_at: string;
}

export interface LegacyImportRun {
	id: number;
	action: LegacyImportAction;
	action_display: string;
	status: LegacyImportStatus;
	status_display: string;
	started_by: string | null;
	started_at: string;
	finished_at: string | null;
	bundle_sha256: string;
	/** Headline counts; shape depends on the action */
	summary: Record<string, unknown>;
	log: string;
	error: string;
}
