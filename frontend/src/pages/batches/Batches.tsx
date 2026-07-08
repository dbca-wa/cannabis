import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	Download,
	MoreHorizontal,
	Trash2,
	Receipt,
	RotateCcw,
	ChevronUp,
	ChevronDown,
	Hash,
	RefreshCw,
} from "lucide-react";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { collapseCertRanges } from "@/shared/utils/certificate-range.utils";
import {
	useBatches,
	useDeleteBatch,
	useRecordInvoiceRaised,
	useUnsetInvoiceRaised,
	downloadBatchZip,
	repackageBatch,
	getBatchExportUrl,
	type Batch,
	type BatchOrdering,
} from "@/features/batches";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { FilterContainer } from "@/shared/components/FilterContainer";
import { PageHeader } from "@/shared/components/PageHeader";
import { OfficerSearchComboBox } from "@/shared/components/police";
import { useOfficerById } from "@/features/police/hooks/useOfficerById";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

type SortKey = "certificate_count" | "bag_count";

/** Sort direction indicator arrow for table headers. */
const SortIcon = ({
	column,
	sortKey,
	ordering,
}: {
	column: SortKey;
	sortKey: SortKey | null;
	ordering: string;
}) => {
	if (sortKey !== column) return null;
	return ordering.startsWith("-") ? (
		<ChevronDown className="inline h-3 w-3" />
	) : (
		<ChevronUp className="inline h-3 w-3" />
	);
};

const BatchCostBreakdown = ({ batch }: { batch: Batch }) => (
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead>Item</TableHead>
				<TableHead className="text-right">Qty</TableHead>
				<TableHead className="text-right">Rate</TableHead>
				<TableHead className="text-right">Cost</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			<TableRow>
				<TableCell>Certificates</TableCell>
				<TableCell className="text-right">{batch.certificate_count}</TableCell>
				<TableCell className="text-right">${batch.cert_rate}</TableCell>
				<TableCell className="text-right">${batch.cert_cost}</TableCell>
			</TableRow>
			<TableRow>
				<TableCell>Bags</TableCell>
				<TableCell className="text-right">{batch.bag_count}</TableCell>
				<TableCell className="text-right">${batch.bag_rate}</TableCell>
				<TableCell className="text-right">${batch.bag_cost}</TableCell>
			</TableRow>
			<TableRow>
				<TableCell colSpan={3}>Subtotal (before tax)</TableCell>
				<TableCell className="text-right">${batch.subtotal}</TableCell>
			</TableRow>
			<TableRow>
				<TableCell colSpan={3}>Tax ({batch.tax_percentage}%)</TableCell>
				<TableCell className="text-right">${batch.tax_amount}</TableCell>
			</TableRow>
			<TableRow className="font-semibold">
				<TableCell colSpan={3}>Total (after tax)</TableCell>
				<TableCell className="text-right">${batch.total}</TableCell>
			</TableRow>
		</TableBody>
	</Table>
);

const Batches = () => {
	useDocumentTitle("Batches");

	const [ordering, setOrdering] = useState<BatchOrdering>("-created_at");
	const { data: batches = [], isLoading } = useBatches(ordering);

	// Client-side search across the (non-paginated) batch list.
	const [officerFilterId, setOfficerFilterId] = useState<number | null>(null);
	const [certSearch, setCertSearch] = useState("");
	const [invoiceSearch, setInvoiceSearch] = useState("");

	// Resolve the selected officer's name to match the batch's officer strings.
	const { data: filterOfficer } = useOfficerById(officerFilterId);
	const officerName = filterOfficer?.full_name ?? "";

	const hasFilters =
		officerFilterId !== null || !!certSearch.trim() || !!invoiceSearch.trim();

	const filteredBatches = useMemo(() => {
		const officer = officerName.trim().toLowerCase();
		const cert = certSearch.trim().toLowerCase();
		const invoice = invoiceSearch.trim().toLowerCase();
		if (officerFilterId === null && !cert && !invoice) return batches;
		return batches.filter((b) => {
			const officerMatch =
				officerFilterId === null ||
				officer === "" ||
				b.submitting_officers.some((o) => o.toLowerCase().includes(officer));
			const certMatch =
				!cert ||
				b.certificate_numbers.some((c) => c.toLowerCase().includes(cert)) ||
				(b.certificate_number_range ?? "").toLowerCase().includes(cert);
			const invoiceMatch =
				!invoice ||
				(b.invoice_raised_number ?? "").toLowerCase().includes(invoice);
			return officerMatch && certMatch && invoiceMatch;
		});
	}, [batches, officerFilterId, officerName, certSearch, invoiceSearch]);

	const clearFilters = () => {
		setOfficerFilterId(null);
		setCertSearch("");
		setInvoiceSearch("");
	};

	const deleteBatch = useDeleteBatch();

	const [detailBatch, setDetailBatch] = useState<Batch | null>(null);
	const [invoiceBatch, setInvoiceBatch] = useState<Batch | null>(null);
	const [invoiceNumber, setInvoiceNumber] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);
	const [unsetTarget, setUnsetTarget] = useState<Batch | null>(null);

	const recordInvoice = useRecordInvoiceRaised(invoiceBatch?.id ?? 0);
	const unsetInvoice = useUnsetInvoiceRaised(unsetTarget?.id ?? 0);

	const sortKey: SortKey | null = useMemo(() => {
		if (ordering.includes("certificate_count")) return "certificate_count";
		if (ordering.includes("bag_count")) return "bag_count";
		return null;
	}, [ordering]);

	const toggleSort = (key: SortKey) => {
		setOrdering((prev) =>
			prev === `-${key}` ? (key as BatchOrdering) : (`-${key}` as BatchOrdering)
		);
	};

	const handleDownload = async (batch: Batch) => {
		try {
			const blob = await downloadBatchZip(batch.id);
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `${batch.batch_number}.zip`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch {
			toast.error("Failed to download batch package");
		}
	};

	const handleRepackage = async (batch: Batch) => {
		try {
			await repackageBatch(batch.id);
			toast.success("Package rebuilt with latest data");
		} catch {
			toast.error("Failed to rebuild package");
		}
	};

	const handleRecordInvoice = async () => {
		if (!invoiceBatch || !invoiceNumber.trim()) return;
		try {
			await recordInvoice.mutateAsync({
				invoice_raised_number: invoiceNumber.trim(),
			});
			setInvoiceBatch(null);
			setInvoiceNumber("");
		} catch {
			// error toast handled by the mutation
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		try {
			await deleteBatch.mutateAsync(deleteTarget.id);
			setDeleteTarget(null);
		} catch {
			// error toast handled by the mutation
		}
	};

	const handleUnset = async () => {
		if (!unsetTarget) return;
		try {
			await unsetInvoice.mutateAsync();
			setUnsetTarget(null);
		} catch {
			// error toast handled by the mutation
		}
	};

	return (
		<div className="space-y-6 p-1">
			<PageHeader
				title={`Batches${!isLoading ? ` (${batches.length})` : ""}`}
				subtitle="Packaged certificate batches and their cost summaries."
				actions={
					<Button asChild variant="outline">
						<a href={getBatchExportUrl()}>
							<Download className="mr-2 h-4 w-4" />
							Export
						</a>
					</Button>
				}
			/>

			{/* Search / filter */}
			<FilterContainer>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<OfficerSearchComboBox
						value={officerFilterId}
						onValueChange={setOfficerFilterId}
						placeholder="Submitting officer..."
						allowCreate={false}
					/>
					<div className="relative">
						<Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
						<Input
							value={certSearch}
							onChange={(e) => setCertSearch(e.target.value)}
							placeholder="Certificate number..."
							className="pl-9"
							aria-label="Search by certificate number"
						/>
					</div>
					<div className="relative">
						<Receipt className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
						<Input
							value={invoiceSearch}
							onChange={(e) => setInvoiceSearch(e.target.value)}
							placeholder="Invoice raised number..."
							className="pl-9"
							aria-label="Search by invoice-raised number"
						/>
					</div>
				</div>
				{hasFilters && (
					<div className="flex items-center justify-between">
						<p className="text-xs text-muted-foreground">
							{filteredBatches.length} of {batches.length} match
						</p>
						<Button
							variant="ghost"
							size="sm"
							onClick={clearFilters}
							className="cursor-pointer"
						>
							Clear filters
						</Button>
					</div>
				)}
			</FilterContainer>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Batch</TableHead>
							<TableHead>Date</TableHead>
							<TableHead>Botanist(s)</TableHead>
							<TableHead>Submitting Officer(s)</TableHead>
							<TableHead>Cert Numbers</TableHead>
							<TableHead
								className="cursor-pointer select-none text-right"
								onClick={() => toggleSort("certificate_count")}
							>
								Certificates{" "}
								<SortIcon
									column="certificate_count"
									sortKey={sortKey}
									ordering={ordering}
								/>
							</TableHead>
							<TableHead
								className="cursor-pointer select-none text-right"
								onClick={() => toggleSort("bag_count")}
							>
								Bags{" "}
								<SortIcon
									column="bag_count"
									sortKey={sortKey}
									ordering={ordering}
								/>
							</TableHead>
							<TableHead className="text-right">Total</TableHead>
							<TableHead>Invoice Raised</TableHead>
							<TableHead className="w-10" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={10} className="text-center py-8">
									Loading batches...
								</TableCell>
							</TableRow>
						) : filteredBatches.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={10}
									className="text-center py-8 text-muted-foreground"
								>
									{hasFilters
										? "No batches match your search."
										: "No batches yet. Create one from the Cases page."}
								</TableCell>
							</TableRow>
						) : (
							filteredBatches.map((batch) => (
								<TableRow
									key={batch.id}
									className="cursor-pointer align-top"
									onClick={() => setDetailBatch(batch)}
								>
									<TableCell className="font-medium align-top">
										{batch.batch_number}
									</TableCell>
									<TableCell className="align-top whitespace-nowrap">
										{new Date(batch.date_batched).toLocaleDateString()}
									</TableCell>
									<TableCell className="align-top">
										{batch.botanists.length > 0 ? (
											<div className="space-y-0.5">
												{batch.botanists.map((name, i) => (
													<div key={i}>{name}</div>
												))}
											</div>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell className="align-top">
										{batch.submitting_officers.length > 0 ? (
											<div className="space-y-0.5">
												{batch.submitting_officers.map((name, i) => (
													<div key={i}>{name}</div>
												))}
											</div>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell className="align-top">
										{batch.certificate_numbers.length > 0 ? (
											<div className="space-y-0.5 tabular-nums">
												{collapseCertRanges(batch.certificate_numbers).map(
													(entry, i) => (
														<div key={i} className="whitespace-nowrap">
															{entry}
														</div>
													)
												)}
											</div>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell className="text-right tabular-nums align-top">
										{batch.certificate_count}
									</TableCell>
									<TableCell className="text-right tabular-nums align-top">
										{batch.bag_count}
									</TableCell>
									<TableCell className="text-right tabular-nums align-top whitespace-nowrap">
										${batch.total}
									</TableCell>
									<TableCell className="align-top">
										{batch.invoice_raised_number ? (
											<Badge className="border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
												{batch.invoice_raised_number}
											</Badge>
										) : (
											<Badge className="border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200">
												Pending
											</Badge>
										)}
									</TableCell>
									<TableCell
										className="align-top"
										onClick={(e) => e.stopPropagation()}
									>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 cursor-pointer"
												>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{batch.invoice_raised_number ? (
													<DropdownMenuItem
														className="cursor-pointer"
														onClick={() => setUnsetTarget(batch)}
													>
														<RotateCcw className="mr-2 h-4 w-4" />
														Unset invoice number
													</DropdownMenuItem>
												) : (
													<DropdownMenuItem
														className="cursor-pointer"
														onClick={() => {
															setInvoiceBatch(batch);
															setInvoiceNumber("");
														}}
													>
														<Receipt className="mr-2 h-4 w-4" />
														Record invoice number
													</DropdownMenuItem>
												)}
												<DropdownMenuItem
													className="cursor-pointer"
													onClick={() => handleDownload(batch)}
												>
													<Download className="mr-2 h-4 w-4" />
													Download package
												</DropdownMenuItem>
												<DropdownMenuItem
													className="cursor-pointer"
													onClick={() => handleRepackage(batch)}
												>
													<RefreshCw className="mr-2 h-4 w-4" />
													Re-package
												</DropdownMenuItem>
												<DropdownMenuItem
													className="cursor-pointer text-red-600"
													onClick={() => setDeleteTarget(batch)}
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Delete batch
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Detail dialog */}
			<Dialog
				open={!!detailBatch}
				onOpenChange={(open) => !open && setDetailBatch(null)}
			>
				<DialogContent className="sm:max-w-[640px]">
					{detailBatch && (
						<>
							<DialogHeader>
								<DialogTitle>{detailBatch.batch_number}</DialogTitle>
								<DialogDescription>
									Batched{" "}
									{new Date(detailBatch.date_batched).toLocaleDateString()} ·{" "}
									{detailBatch.certificate_count} certificate(s) ·{" "}
									{detailBatch.bag_count} bag(s)
								</DialogDescription>
							</DialogHeader>

							{/* Primary actions for this batch */}
							<div className="flex flex-wrap items-center gap-2 py-3 border-b">
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										handleDownload(detailBatch);
									}}
								>
									<Download className="mr-2 h-4 w-4" />
									Download Package
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										handleRepackage(detailBatch);
									}}
								>
									<RefreshCw className="mr-2 h-4 w-4" />
									Re-package
								</Button>
								{detailBatch.invoice_raised_number ? (
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											setUnsetTarget(detailBatch);
											setDetailBatch(null);
										}}
									>
										<RotateCcw className="mr-2 h-4 w-4" />
										Unset Invoice ({detailBatch.invoice_raised_number})
									</Button>
								) : (
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											setInvoiceBatch(detailBatch);
											setInvoiceNumber("");
											setDetailBatch(null);
										}}
									>
										<Receipt className="mr-2 h-4 w-4" />
										Set Invoice Number
									</Button>
								)}
								<Button
									size="sm"
									variant="destructive"
									onClick={() => {
										setDeleteTarget(detailBatch);
										setDetailBatch(null);
									}}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete Batch
								</Button>
							</div>

							<BatchCostBreakdown batch={detailBatch} />
							<div className="mt-4">
								<p className="text-sm font-medium mb-1">Certificate numbers</p>
								{detailBatch.certificate_numbers.length > 0 ? (
									<div className="text-sm text-muted-foreground tabular-nums space-y-0.5">
										{collapseCertRanges(detailBatch.certificate_numbers).map(
											(entry, i) => (
												<div key={i}>{entry}</div>
											)
										)}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">—</p>
								)}
							</div>
							<div className="mt-4">
								<p className="text-sm font-medium mb-1">Cases</p>
								<p className="text-sm text-muted-foreground">
									{detailBatch.case_numbers.join(", ")}
								</p>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>

			{/* Record invoice dialog */}
			<Dialog
				open={!!invoiceBatch}
				onOpenChange={(open) => !open && setInvoiceBatch(null)}
			>
				<DialogContent className="sm:max-w-[440px]">
					<DialogHeader>
						<DialogTitle>Record invoice-raised number</DialogTitle>
						<DialogDescription>
							Entering a unique invoice number marks every case in this batch as
							complete.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={invoiceNumber}
						onChange={(e) => setInvoiceNumber(e.target.value)}
						placeholder="e.g. 6062"
						aria-label="Invoice-raised number"
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setInvoiceBatch(null)}>
							Cancel
						</Button>
						<Button
							onClick={handleRecordInvoice}
							disabled={!invoiceNumber.trim() || recordInvoice.isPending}
						>
							{recordInvoice.isPending ? "Saving..." : "Record & complete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation */}
			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this batch?</AlertDialogTitle>
						<AlertDialogDescription>
							The batch will be removed and its cases returned to the batching
							phase. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Unset invoice confirmation */}
			<AlertDialog
				open={!!unsetTarget}
				onOpenChange={(open) => !open && setUnsetTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unset the invoice number?</AlertDialogTitle>
						<AlertDialogDescription>
							This clears the invoice-raised number
							{unsetTarget?.invoice_raised_number
								? ` (${unsetTarget.invoice_raised_number})`
								: ""}{" "}
							and returns this batch's cases from Complete to In Batch. You can
							record a new invoice number afterwards.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleUnset}
							disabled={unsetInvoice.isPending}
							className="bg-amber-600 hover:bg-amber-700"
						>
							{unsetInvoice.isPending ? "Unsetting..." : "Unset invoice"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default Batches;
