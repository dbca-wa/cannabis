import ContentLayout from "@/shared/components/layout/ContentLayout";
import CreateSubmissionButton from "@/features/dash/components/CreateSubmissionButton";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";
import StatsPanel from "@/features/dash/components/StatsPanel";
import MySubmissionTable from "@/features/dash/components/MySubmissionTable";
import { Head } from "@/shared/components/layout/Head";

const Home = () => {
	// For Home page, use empty breadcrumbs array to let the automatic "Home" item handle it
	const breadcrumbs: BreadcrumbItem[] = [];

	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			showHomeBreadcrumb={true}
			className="space-y-6"
		>
			<Head title="Home" />
			<div className="flex w-full gap-2">
				<div className="w-full bg-white">
					<MySubmissionTable />
				</div>
				<div className="flex flex-col w-full">
					<CreateSubmissionButton />
					<div className="mt-2 bg-white p-5 rounded-xl">
						<StatsPanel />
					</div>
				</div>
			</div>
		</ContentLayout>
	);
};

export default Home;
