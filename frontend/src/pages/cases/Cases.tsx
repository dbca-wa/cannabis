import { useState, useCallback } from "react";
import { Outlet, useMatch } from "react-router";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/shared/components/PageHeader";
import { PageTransition } from "@/shared/components/PageTransition";
import { PoliceButton } from "@/shared/components/NewCaseButton";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { CasesFilters } from "@/features/cases/components/CasesFilters";
import { CasesTable } from "@/features/cases/components/CasesTable";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import type { CaseTiny } from "@/shared/types/backend-api.types";

const Cases = () => {
	const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
	const [cases, setCases] = useState<CaseTiny[]>([]);

	// Export handlers
	const handleExportCSV = useCallback(() => {
		const filename = generateFilename("submissions_all", "csv");
		exportToCSV(cases, commonExportColumns.caseObj, { filename });
		toast.success(`Exported ${cases.length} cases to CSV`);
	}, [cases]);

	const handleExportJSON = useCallback(() => {
		const filename = generateFilename("submissions_all", "json");
		exportToJSON(cases, commonExportColumns.caseObj, { filename });
		toast.success(`Exported ${cases.length} cases to JSON`);
	}, [cases]);

	// Hide the table when viewing a full-page child route
	const isAddPage = useMatch("/cases/add");
	const isEditPage = useMatch("/cases/:submissionId");
	const isDetailPage = useMatch("/cases/:submissionId/detail");
	const isFullPageChild = isAddPage || isEditPage || isDetailPage;

	return (
		<>
			{!isFullPageChild && (
				<>
					<PageHeader
						title={`Cases${totalCount !== undefined ? ` (${totalCount})` : ""}`}
						subtitle="Track suspected cannabis specimens through identification and certification."
						actions={
							<div className="flex items-center gap-2">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button className="relative inline-flex items-center gap-2 rounded-xl text-white shadow-md ring-1 ring-white/10 overflow-hidden bg-gradient-to-b from-slate-500 to-slate-700 dark:from-slate-700 dark:to-slate-900 px-6 py-3.5 text-base font-semibold cursor-pointer hover:from-slate-400 hover:to-slate-600 transition-all">
											<span className="tracking-tight whitespace-nowrap">
												Export
											</span>
											<ChevronDown className="w-4 h-4 fill-current" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={handleExportCSV}>
											Export as CSV
										</DropdownMenuItem>
										<DropdownMenuItem onClick={handleExportJSON}>
											Export as JSON
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								<PoliceButton to="/cases/add" label="New Case" size="lg" />
							</div>
						}
					/>
					<PageTransition className="space-y-4">
						<CasesFilters />
						<CasesTable
							onCountChange={setTotalCount}
							onCasesChange={setCases}
						/>
					</PageTransition>
				</>
			)}
			<Outlet />
		</>
	);
};

export default Cases;
