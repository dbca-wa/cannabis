import { DefendantsTable } from "@/features/defendants";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";

const Defendants = () => {
	// Breadcrumb configuration
	const breadcrumbs: BreadcrumbItem[] = [
		{
			label: "Defendants",
			current: true,
		},
	];

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="xl">
			<SectionWrapper variant="minimal">
				<DefendantsTable />
			</SectionWrapper>
		</ContentLayout>
	);
};

export default Defendants;
