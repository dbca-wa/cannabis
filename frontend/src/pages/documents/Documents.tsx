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
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";
import { CertificatesTable } from "@/features/certificates/components";
import { InvoicesTable } from "@/features/invoices/components";

const Documents = () => {
	const location = useLocation();
	const navigate = useNavigate();

	// Determine active tab from current route
	const getActiveTabFromPath = (pathname: string): string => {
		if (pathname.includes("/docs/invoices")) {
			return "invoices";
		}
		return "certificates"; // Default to certificates
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
		navigate(`/docs/${value}`);
	};

	// Generate breadcrumbs with tab context
	const getBreadcrumbs = (): BreadcrumbItem[] => {
		const tabLabel = activeTab === "invoices" ? "Invoices" : "Certificates";
		return [
			{
				label: "Documents",
				href: "/docs/certificates",
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
						<TabsTrigger value="certificates">
							Certificates
						</TabsTrigger>
						<TabsTrigger value="invoices">Invoices</TabsTrigger>
					</TabsList>

					<TabsContent value="certificates" className="space-y-4">
						<SectionWrapper variant="minimal">
							<CertificatesTable />
						</SectionWrapper>
					</TabsContent>

					<TabsContent value="invoices" className="space-y-4">
						<SectionWrapper variant="minimal">
							<InvoicesTable />
						</SectionWrapper>
					</TabsContent>
				</Tabs>
			</div>
		</ContentLayout>
	);
};

export default Documents;
