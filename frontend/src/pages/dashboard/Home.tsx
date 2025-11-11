import ContentLayout from "@/shared/components/layout/ContentLayout";
import CreateSubmissionButton from "@/features/dash/components/CreateSubmissionButton";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";
import StatsPanel from "@/features/dash/components/StatsPanel";
import MySubmissionTable from "@/features/dash/components/MySubmissionTable";
import { cn } from "@/shared";
import "@/features/dash/components/Stats.css";

const Home = () => {
	// For Home page, use empty breadcrumbs array to let the automatic "Home" item handle it
	const breadcrumbs: BreadcrumbItem[] = [];

	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			showHomeBreadcrumb={true}
			className="space-y-6 "
			title="Home"
		>
			<div className={cn("flex flex-col w-full gap-5")}>
				<div className="w-full flex flex-col gap-8 stat-panel stats-container">
					<CreateSubmissionButton />
					<StatsPanel />
				</div>
				<div className="rounded-[10px] stat-panel stats-container p-4 w-full h-full">
					<MySubmissionTable />
				</div>
			</div>
		</ContentLayout>
	);
};

export default Home;
