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
import { useEffect } from "react";

const UsersList = () => {
	const { users: usersQueryData, isLoading, error } = useUsers();
	useEffect(() => {
		if (!isLoading && usersQueryData) {
			console.log(usersQueryData);
		}
	}, [isLoading, usersQueryData]);

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
				<TableRow className="border-b border-slate-800 dark:border-slate-800 hover:bg-transparent dark:hover-transparent select-none ">
					<TableHead>ID</TableHead>
					<TableHead>Username</TableHead>
					<TableHead>Email</TableHead>
					<TableHead>Role</TableHead>
					<TableHead>Admin</TableHead>
					<TableHead>Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="hover:bg-transparent dark:hover-transparent select-none">
				{usersQueryData?.users?.map((user: User) => (
					<UserItem key={user.id} user={user} />
				))}
			</TableBody>
		</Table>
	);
};

export default UsersList;
