import React from "react";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import { SubmissionsTable } from "@/features/submissions/components";

const Submissions: React.FC = () => {
	const breadcrumbs = [{ label: "Submissions", current: true }];

	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			maxWidth="xl"
			title="Submissions"
		>
			<SectionWrapper variant="minimal">
				<SubmissionsTable />
			</SectionWrapper>
		</ContentLayout>
	);
};

export default Submissions;
