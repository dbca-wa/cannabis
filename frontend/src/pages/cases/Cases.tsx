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
import type { Certificate } from "@/features/certificates/types/certificates.types";

/** Extract all batch-eligible certificate IDs from a case's forms. */
const getEligibleCertificateIds = (caseObj: CaseTiny): number[] =>
	caseObj.forms
		.map((f) => f.certificate)
		.filter((c): c is Certificate => c !== null && c.is_batch_eligible)
		.map((c) => c.id);

const Cases = () => {
	const navigate = useNavigate();
	const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
	const [selectedCertificateIds, setSelectedCertificateIds] = useState<
		Set<number>
	>(new Set());

	const createBatch = useCreateBatch();

	// Toggle all eligible certificate IDs for a given case row.
	const toggleSelect = useCallback((caseObj: CaseTiny) => {
		const certIds = getEligibleCertificateIds(caseObj);
		if (certIds.length === 0) return;

		setSelectedCertificateIds((prev) => {
			const next = new Set(prev);
			const allSelected = certIds.every((id) => next.has(id));
			if (allSelected) {
				certIds.forEach((id) => next.delete(id));
			} else {
				certIds.forEach((id) => next.add(id));
			}
			return next;
		});
	}, []);

	// Toggle all eligible certificate IDs from all shown eligible cases.
	const toggleSelectAll = useCallback((eligible: CaseTiny[]) => {
		setSelectedCertificateIds((prev) => {
			const allCertIds = eligible.flatMap(getEligibleCertificateIds);
			const allSelected =
				allCertIds.length > 0 && allCertIds.every((id) => prev.has(id));
			const next = new Set(prev);
			if (allSelected) {
				allCertIds.forEach((id) => next.delete(id));
			} else {
				allCertIds.forEach((id) => next.add(id));
			}
			return next;
		});
	}, []);

	const handleCreateBatch = useCallback(async () => {
		if (selectedCertificateIds.size === 0) return;
		try {
			await createBatch.mutateAsync({
				certificate_ids: Array.from(selectedCertificateIds),
			});
			setSelectedCertificateIds(new Set());
			navigate("/batches");
		} catch {
			// error toast handled by the mutation
		}
	}, [selectedCertificateIds, createBatch, navigate]);

	// Hide the table when viewing a full-page child route
	const isAddPage = useMatch("/cases/add");
	const isCasePage = useMatch("/cases/:id");
	const isFullPageChild = isAddPage || isCasePage;

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
									disabled={
										createBatch.isPending || selectedCertificateIds.size === 0
									}
									title={
										selectedCertificateIds.size === 0
											? "Select one or more cases with eligible certificates to create a batch"
											: undefined
									}
									className="relative inline-flex items-center gap-2 rounded-xl text-white shadow-md ring-1 ring-white/10 overflow-hidden bg-gradient-to-b from-violet-500 to-violet-700 dark:from-violet-600 dark:to-violet-800 px-6 py-3.5 text-base font-semibold cursor-pointer hover:from-violet-400 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-violet-500 disabled:hover:to-violet-700"
								>
									<Boxes className="w-4 h-4" />
									<span className="tracking-tight whitespace-nowrap">
										{createBatch.isPending
											? "Creating..."
											: selectedCertificateIds.size > 0
												? `Create Batch (${selectedCertificateIds.size} cert${selectedCertificateIds.size === 1 ? "" : "s"})`
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
							selectedCertificateIds={selectedCertificateIds}
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
