import { useState } from "react";
import { useNavigate, Outlet, useMatch } from "react-router";
import { Merge } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { PageTransition } from "@/shared/components/PageTransition";
import { PoliceButton } from "@/shared/components/NewCaseButton";
import { DefendantsFilters } from "@/features/defendants/components/DefendantsFilters";
import { DefendantsTable } from "@/features/defendants/components/DefendantsTable";

const Defendants = () => {
	const navigate = useNavigate();
	const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

	// Full-page child routes that replace the list view
	const isMergePage = useMatch("/defendants/merge");
	const isFullPageChild = isMergePage;

	return (
		<>
			{!isFullPageChild && (
				<>
					<PageHeader
						title={`Defendants${totalCount !== undefined ? ` (${totalCount})` : ""}`}
						subtitle="People linked to cannabis identification cases."
						actions={
							<div className="flex items-center gap-2">
								<button
									onClick={() => navigate("/defendants/merge")}
									className="relative inline-flex items-center gap-2 rounded-xl text-white shadow-md ring-1 ring-white/10 overflow-hidden bg-gradient-to-b from-slate-500 to-slate-700 dark:from-slate-700 dark:to-slate-900 px-6 py-3.5 text-base font-semibold cursor-pointer hover:from-slate-400 hover:to-slate-600 transition-all"
								>
									<Merge className="w-5 h-5 -ml-0.5" />
									<span className="tracking-tight whitespace-nowrap">
										Merge
									</span>
								</button>
								<PoliceButton
									to="/defendants/add"
									label="Add Defendant"
									size="lg"
								/>
							</div>
						}
					/>
					<PageTransition className="space-y-4">
						<DefendantsFilters />
						<DefendantsTable onCountChange={setTotalCount} />
					</PageTransition>
				</>
			)}
			<Outlet />
		</>
	);
};

export default Defendants;
