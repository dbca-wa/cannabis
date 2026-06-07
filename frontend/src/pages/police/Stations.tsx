import { useState } from "react";
import { Outlet, useNavigate, useMatch } from "react-router";
import { Merge } from "lucide-react";
import { PageHeader } from "@/shared/components/PageHeader";
import { PageTransition } from "@/shared/components/PageTransition";
import { PoliceButton } from "@/shared/components/NewCaseButton";
import { StationsFilters } from "@/features/police/components/stations/StationsFilters";
import { PoliceStationsTable } from "@/features/police/components/stations/PoliceStationsTable";

const Stations = () => {
	const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
	const navigate = useNavigate();

	// Full-page child routes that replace the list view
	const isMergePage = useMatch("/stations/merge");
	const isFullPageChild = isMergePage;

	return (
		<>
			{!isFullPageChild && (
				<>
					<PageHeader
						title={`Stations${totalCount !== undefined ? ` (${totalCount})` : ""}`}
						subtitle="Police stations associated with cannabis identification cases."
						actions={
							<div className="flex items-center gap-2">
								<button
									onClick={() => navigate("/stations/merge")}
									className="relative inline-flex items-center gap-2 rounded-xl text-white shadow-md ring-1 ring-white/10 overflow-hidden bg-gradient-to-b from-slate-500 to-slate-700 dark:from-slate-700 dark:to-slate-900 px-6 py-3.5 text-base font-semibold cursor-pointer hover:from-slate-400 hover:to-slate-600 transition-all"
								>
									<Merge className="w-4 h-4" />
									<span className="tracking-tight whitespace-nowrap">
										Merge
									</span>
								</button>
								<PoliceButton
									to="/stations/add"
									label="Add Station"
									size="lg"
								/>
							</div>
						}
					/>
					<PageTransition className="space-y-4">
						<StationsFilters />
						<PoliceStationsTable onCountChange={setTotalCount} />
					</PageTransition>
				</>
			)}
			<Outlet />
		</>
	);
};

export default Stations;
