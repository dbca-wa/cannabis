import { observer } from "mobx-react-lite";
import { useUsers } from "@/hooks/tanstack/useUsers";
import {
	Table,
	TableHeader,
	TableRow,
	TableHead,
	TableBody,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import UserItem from "@/components/users/UserItem";
import { User } from "@/types";

const UsersList = observer(() => {
	const { users, isLoading, error } = useUsers();

	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array(5)
					.fill(0)
					.map((_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
			</div>
		);
	}

	if (error) {
		return <div>Error loading users</div>;
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>ID</TableHead>
					<TableHead>Username</TableHead>
					<TableHead>Email</TableHead>
					<TableHead>Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{users?.map((user: User) => (
					<UserItem key={user.id} user={user} />
				))}
			</TableBody>
		</Table>
	);
});

export default UsersList;
