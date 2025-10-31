import { ContentLayout } from "@/shared";
import { Head } from "@/shared/components/layout/Head";
import { useNavigate } from "react-router";

const TestModule = ({ href, title }: { href: string; title: string }) => {
	const navigate = useNavigate();

	return (
		<div
			onClick={() => navigate(href)}
			className="bg-white rounded-lg p-4 cursor-pointer"
		>
			<p>{title}</p>
			<div></div>
		</div>
	);
};

const TestsHomePage = () => {
	const breadcrumbs = [
		{
			label: "Tests",
			current: true,
		},
	];

	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			showHomeBreadcrumb={true}
			className="space-y-6"
		>
			<Head title="Tests" />
			<div className="grid grid-cols-3 gap-4">
				<TestModule href="/tests/emails" title="Test Emails" />
				<TestModule href="/tests/invoices" title="Test Invoices" />
				<TestModule
					href="/tests/certificates"
					title="Test Certificates"
				/>
			</div>
		</ContentLayout>
	);
};

export default TestsHomePage;
