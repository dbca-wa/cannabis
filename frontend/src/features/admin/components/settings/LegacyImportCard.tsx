import { useRef, useState } from "react";
import { DatabaseBackup, Loader2, Trash2, Upload } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import ConfirmationDialog from "@/features/admin/components/settings/ConfirmationDialog";
import { useLegacyImport } from "@/features/admin/hooks/useLegacyImport";
import type {
	LegacyImportAction,
	LegacyImportRun,
} from "@/features/admin/types/legacyImport.types";

interface LegacyImportCardProps {
	/** Used to label the confirmation dialogs (staging, production) */
	environment?: string;
}

const STATUS_STYLES: Record<LegacyImportRun["status"], string> = {
	running: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
	succeeded:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
	problems:
		"bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
};

const CONFIRM: Partial<
	Record<
		LegacyImportAction,
		{ title: string; description: string; confirmText: string }
	>
> = {
	import: {
		title: "Import the legacy data?",
		description:
			"Creates a legacy case for every police reference in the bundle, then checks the result against the old system's table. Cases already imported are left alone.",
		confirmText: "Import",
	},
	undo: {
		title: "Remove the imported legacy data?",
		description:
			"Deletes every legacy case and the officers, stations, defendants and botanist accounts the import created, unless a case made in the app still uses them. Cases made in the app are never touched.",
		confirmText: "Remove legacy data",
	},
};

const formatDateTime = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleString("en-AU", {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: "";

/** Headline numbers for a finished run, in plain words. */
const describeRun = (run: LegacyImportRun): string[] => {
	const summary = run.summary as {
		counts?: Record<string, number>;
		failed_cases?: number;
		conflicts?: number;
		certificates_to_check?: number;
		certificates_without_result?: number;
		reconcile?: { checks: number; unexplained: number; explained: number };
		removed?: Record<string, number>;
	};
	const lines: string[] = [];
	const c = summary.counts;
	if (c) {
		lines.push(
			`${c.cases ?? 0} cases, ${c.forms ?? 0} forms, ${c.bags ?? 0} bags` +
				(c["cases already imported"]
					? `; ${c["cases already imported"]} already imported`
					: "")
		);
	}
	if (summary.failed_cases)
		lines.push(`${summary.failed_cases} case(s) failed`);
	if (summary.conflicts)
		lines.push(`${summary.conflicts} case number(s) already used by app cases`);
	if (summary.certificates_to_check)
		lines.push(
			`${summary.certificates_to_check} certificate(s) need a person to check the bag results`
		);
	if (summary.certificates_without_result)
		lines.push(
			`${summary.certificates_without_result} certificate(s) have no result in the source`
		);
	if (summary.reconcile)
		lines.push(
			`${summary.reconcile.checks.toLocaleString()} checks: ${summary.reconcile.unexplained} unexplained, ${summary.reconcile.explained} explained`
		);
	if (summary.removed)
		lines.push(
			Object.entries(summary.removed)
				.map(([label, n]) => `${n} ${label}`)
				.join(", ") || "Nothing to remove"
		);
	if (run.error) lines.push(run.error);
	return lines;
};

/**
 * Upload the legacy import bundle and run the import, its checks or an undo.
 * Shown only to maintainers; the server enforces the same rule.
 */
export const LegacyImportCard = ({ environment }: LegacyImportCardProps) => {
	const { bundle, runs, isLoading, isRunning, upload, removeBundle, start } =
		useLegacyImport(true);
	const fileInput = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [confirming, setConfirming] = useState<LegacyImportAction | null>(null);
	const [showLogFor, setShowLogFor] = useState<number | null>(null);

	const busy = isRunning || start.isPending;
	const run = (action: LegacyImportAction) =>
		CONFIRM[action] ? setConfirming(action) : start.mutate(action);

	const handleUpload = async () => {
		if (!file) return;
		try {
			await upload.mutateAsync(file);
			setFile(null);
			if (fileInput.current) fileInput.current.value = "";
		} catch {
			// The mutation shows the error
		}
	};

	return (
		<Card className="p-6">
			<div className="mb-5 flex items-start gap-3">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 text-white">
					<DatabaseBackup className="h-5 w-5" aria-hidden="true" />
				</div>
				<div>
					<h3>Legacy import</h3>
					<p className="text-[13px] text-muted-foreground">
						Imports the certificates from the old database. Upload the bundle
						built with <code>python -m etl.bundle</code>, run a dry run, then
						import. Only maintainers can see this. Delete the bundle once the
						import is done: it holds personal data.
					</p>
				</div>
			</div>

			<div className="space-y-6">
				<section aria-labelledby="legacy-bundle-heading" className="space-y-3">
					<h4 id="legacy-bundle-heading" className="text-sm font-medium">
						Bundle
					</h4>
					{isLoading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : bundle ? (
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
							<div>
								<p className="font-medium">{bundle.filename}</p>
								<p className="text-muted-foreground">
									{bundle.summary.source_rows?.toLocaleString()} source rows,
									uploaded {formatDateTime(bundle.uploaded_at)}
									{bundle.uploaded_by ? ` by ${bundle.uploaded_by}` : ""}.
									Checksum {bundle.sha256.slice(0, 12)}
								</p>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => removeBundle.mutate()}
								disabled={removeBundle.isPending || busy}
								className="text-red-700 hover:text-red-800"
							>
								<Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
								Delete bundle
							</Button>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">No bundle uploaded.</p>
					)}
					<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
						<div className="flex-1 space-y-1">
							<Label htmlFor="legacy-bundle-file">
								{bundle ? "Replace with a new bundle" : "Bundle file (.zip)"}
							</Label>
							<Input
								id="legacy-bundle-file"
								ref={fileInput}
								type="file"
								accept=".zip,application/zip"
								onChange={(e) => setFile(e.target.files?.[0] ?? null)}
								disabled={upload.isPending || busy}
							/>
						</div>
						<Button
							type="button"
							onClick={handleUpload}
							disabled={!file || upload.isPending || busy}
							className="min-h-11"
						>
							{upload.isPending ? (
								<Loader2
									className="mr-2 h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
							) : (
								<Upload className="mr-2 h-4 w-4" aria-hidden="true" />
							)}
							Upload
						</Button>
					</div>
				</section>

				<section aria-labelledby="legacy-tasks-heading" className="space-y-3">
					<h4 id="legacy-tasks-heading" className="text-sm font-medium">
						Tasks
					</h4>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={!bundle || busy}
							onClick={() => run("dry_run")}
						>
							Dry run
						</Button>
						<Button
							type="button"
							disabled={!bundle || busy}
							onClick={() => run("import")}
						>
							Import
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={!bundle || busy}
							onClick={() => run("reconcile")}
						>
							Check imported data
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => run("undo")}
							className="text-red-700 hover:text-red-800"
						>
							Undo import
						</Button>
					</div>
					{isRunning && (
						<p
							role="status"
							className="flex items-center gap-2 text-sm text-muted-foreground"
						>
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />A
							task is running. This can take a few minutes; you can leave the
							page.
						</p>
					)}
				</section>

				<section aria-labelledby="legacy-runs-heading" className="space-y-2">
					<h4 id="legacy-runs-heading" className="text-sm font-medium">
						Recent runs
					</h4>
					{runs.length === 0 ? (
						<p className="text-sm text-muted-foreground">No runs yet.</p>
					) : (
						<ul className="space-y-2">
							{runs.map((r) => (
								<li key={r.id} className="rounded-lg border p-3 text-sm">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium">{r.action_display}</span>
										<span
											className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
										>
											{r.status_display}
										</span>
										<span className="text-muted-foreground">
											{formatDateTime(r.started_at)}
											{r.started_by ? `, ${r.started_by}` : ""}
										</span>
										{r.log && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="ml-auto"
												aria-expanded={showLogFor === r.id}
												onClick={() =>
													setShowLogFor(showLogFor === r.id ? null : r.id)
												}
											>
												{showLogFor === r.id ? "Hide log" : "Show log"}
											</Button>
										)}
									</div>
									{r.status !== "running" && (
										<ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
											{describeRun(r).map((line) => (
												<li key={line}>{line}</li>
											))}
										</ul>
									)}
									{showLogFor === r.id && (
										<pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
											{r.log}
										</pre>
									)}
								</li>
							))}
						</ul>
					)}
				</section>
			</div>

			{confirming && CONFIRM[confirming] && (
				<ConfirmationDialog
					isOpen
					onClose={() => setConfirming(null)}
					onConfirm={async () => {
						const action = confirming;
						setConfirming(null);
						try {
							await start.mutateAsync(action);
						} catch {
							// The mutation shows the error
						}
					}}
					title={CONFIRM[confirming].title}
					description={CONFIRM[confirming].description}
					confirmText={CONFIRM[confirming].confirmText}
					variant="destructive"
					environment={environment}
					isLoading={start.isPending}
				/>
			)}
		</Card>
	);
};
