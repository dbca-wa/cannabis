import { Link } from "react-router";
import { observer } from "mobx-react-lite";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/rootStore";

const UsersHeader = observer(() => {
	const authStore = useAuthStore();

	return (
		<div className="flex justify-between items-center">
			<h1 className="text-3xl font-bold">Users</h1>
			{authStore.isAdmin && (
				<Button asChild>
					<Link to="/users/add">Add User</Link>
				</Button>
			)}
		</div>
	);
});

export default UsersHeader;
