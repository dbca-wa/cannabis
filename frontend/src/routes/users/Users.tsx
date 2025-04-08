import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useUIStore } from "@/stores/rootStore";
import UsersList from "@/components/users/UsersList";
import UsersHeader from "@/components/users/UsersHeader";

const Users = observer(() => {
	const uiStore = useUIStore();

	// Set page metadata when the component mounts
	useEffect(() => {
		uiStore.setPageMetadata({
			title: "Users",
			description: "Manage system users",
			breadcrumbs: [
				{ label: "Dashboard", path: "/" },
				{ label: "Users" },
			],
			actions: [
				{
					label: "Add User",
					handler: () => {
						// You could use navigate here or implement the action
						window.location.href = "/users/add";
					},
					variant: "default",
				},
			],
		});
	}, [uiStore]);

	return (
		<div className="space-y-6">
			<UsersHeader />
			<UsersList />
		</div>
	);
});

export default Users;
