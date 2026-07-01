import { useState, useCallback } from "react";
import { Outlet, useMatch, useNavigate } from "react-router";
import { Boxes } from "lucide-react";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { PageHeader } from "@/shared/components/PageHeader";
import { PageTransition } from "@/shared/components/PageTransition";
import { PoliceButton } from "@/shared/components/NewCaseButton";
import { CasesFilters } from "@/features/cases/components/CasesFilters";
import { CasesTable } from "@/features/cases/components/CasesTable";
import { useCreateBatch } from "@/features/batches";
import type { CaseTiny } from "@/shared/types/backend-api.types";

const Cases = () => {
	const navigate = useNavigate();
	const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

	const createBatch = useCreateBatch();

	const toggleSelect = useCallback((caseObj: CaseTiny) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(caseObj.id)) {
				next.delete(caseObj.id);
			} else {
				next.add(caseObj.id);
			}
			return next;
		});
	}, []);

	// Select (or clear) every batching-eligible case currently shown.
	const toggleSelectAll = useCallback((eligible: CaseTiny[]) => {
		setSelectedIds((prev) => {
			const allSelected =
				eligible.length > 0 && eligible.every((c) => prev.has(c.id));
			const next = new Set(prev);
			if (allSelected) {
				eligible.forEach((c) => next.delete(c.id));
			} else {
				eligible.forEach((c) => next.add(c.id));
			}
			return next;
		});
	}, []);

	const handleCreateBatch = useCallback(async () => {
		if (selectedIds.size === 0) return;
		try {
			await createBatch.mutateAsync({ case_ids: Array.from(selectedIds) });
			setSelectedIds(new Set());
			navigate("/batches");
		} catch {
			// error toast handled by the mutation
		}
	}, [selectedIds, createBatch, navigate]);

	// Hide the table when viewing a full-page child route
	const isAddPage = useMatch("/cases/add");
	const isEditPage = useMatch("/cases/:submissionId");
	const isProcessPage = useMatch("/cases/:id/process");
	const isFullPageChild = isAddPage || isEditPage || isProcessPage;

	useDocumentTitle("Cases");

	return (
		<>
			{!isFullPageChild && (
				<>
					<PageHeader
						title={`Cases${totalCount !== undefined ? ` (${totalCount})` : ""}`}
						subtitle="Track suspected cannabis specimens through identification and certification."
						actions={
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleCreateBatch}
									disabled={createBatch.isPending || selectedIds.size === 0}
									title={
										selectedIds.size === 0
											? "Select one or more cases in the Batching state to create a batch"
											: undefined
									}
									className="relative inline-flex items-center gap-2 rounded-xl text-white shadow-md ring-1 ring-white/10 overflow-hidden bg-gradient-to-b from-violet-500 to-violet-700 dark:from-violet-600 dark:to-violet-800 px-6 py-3.5 text-base font-semibold cursor-pointer hover:from-violet-400 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-violet-500 disabled:hover:to-violet-700"
								>
									<Boxes className="w-4 h-4" />
									<span className="tracking-tight whitespace-nowrap">
										{createBatch.isPending
											? "Creating..."
											: selectedIds.size > 0
												? `Create Batch (${selectedIds.size})`
												: "Create Batch"}
									</span>
								</button>
								<PoliceButton to="/cases/add" label="New Case" size="lg" />
							</div>
						}
					/>
					<PageTransition className="space-y-4">
						<CasesFilters />
						<CasesTable
							onCountChange={setTotalCount}
							selectedIds={selectedIds}
							onToggleSelect={toggleSelect}
							onToggleSelectAll={toggleSelectAll}
						/>
					</PageTransition>
				</>
			)}
			<Outlet />
		</>
	);
};

export default Cases;
