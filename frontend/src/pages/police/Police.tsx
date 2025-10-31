import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { PoliceStationsTable, PoliceOfficersTable } from "@/features/police";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";
import { Head } from "@/shared/components/layout/Head";

const Police = () => {
	const location = useLocation();
	const navigate = useNavigate();

	// Determine active tab from current route
	const getActiveTabFromPath = (pathname: string): string => {
		if (pathname.includes("/police/stations")) {
			return "stations";
		}
		return "officers"; // Default to officers
	};

	const [activeTab, setActiveTab] = useState(() =>
		getActiveTabFromPath(location.pathname)
	);

	// Update active tab when route changes
	useEffect(() => {
		const newTab = getActiveTabFromPath(location.pathname);
		setActiveTab(newTab);
	}, [location.pathname]);

	// Handle tab change by navigating to appropriate route
	const handleTabChange = (value: string) => {
		setActiveTab(value);
		navigate(`/police/${value}`);
	};

	// Generate breadcrumbs with tab context
	const getBreadcrumbs = (): BreadcrumbItem[] => {
		const tabLabel = activeTab === "stations" ? "Stations" : "Officers";
		return [
			{
				label: "Police Management",
				href: "/police/officers",
			},
			{
				label: tabLabel,
				current: true,
			},
		];
	};

	const breadcrumbs = getBreadcrumbs();

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="xl">
			<div className="space-y-6">
				<Tabs
					value={activeTab}
					onValueChange={handleTabChange}
					className="w-full"
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="officers">Officers</TabsTrigger>
						<TabsTrigger value="stations">Stations</TabsTrigger>
					</TabsList>

					<TabsContent value="officers" className="space-y-4">
						<Head title="Officers" />
						<SectionWrapper variant="minimal">
							<PoliceOfficersTable />
						</SectionWrapper>
					</TabsContent>

					<TabsContent value="stations" className="space-y-4">
						<Head title="Stations" />
						<SectionWrapper variant="minimal">
							<PoliceStationsTable />
						</SectionWrapper>
					</TabsContent>
				</Tabs>
			</div>
		</ContentLayout>
	);
};

export default Police;
