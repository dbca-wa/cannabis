import { AllUsersTable } from "@/features/user";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import { Head } from "@/shared/components/layout/Head";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";

const Users = () => {
	// Breadcrumb configuration
	const breadcrumbs: BreadcrumbItem[] = [
		{
			label: "User Management",
			current: true,
		},
	];

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="xl">
			<Head title="Users" />
			<AllUsersTable />
		</ContentLayout>
	);
};

export default Users;
