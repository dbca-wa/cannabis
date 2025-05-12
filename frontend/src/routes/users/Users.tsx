import UsersList from "@/components/users/UsersList";
import { observer } from "mobx-react-lite";

const Users = observer(() => {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold">Users</h1>
			</div>
			<UsersList />
		</div>
	);
});

export default Users;
