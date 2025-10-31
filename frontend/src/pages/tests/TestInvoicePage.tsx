import { ContentLayout, type BreadcrumbItem } from "@/shared";
import { Head } from "@/shared/components/layout/Head";

const TestInvoicePage = () => {
	const breadcrumbs: BreadcrumbItem[] = [
		{ label: "Tests", href: "/tests" },
		{ label: "Invoices", current: true },
	];
	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			showHomeBreadcrumb={true}
			className="space-y-6"
		>
			<Head title="Invoice Test" />
		</ContentLayout>
	);
};

export default TestInvoicePage;
