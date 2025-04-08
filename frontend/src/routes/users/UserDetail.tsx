import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "react-router";
import { observer } from "mobx-react-lite";
import { useAuthStore, useUIStore } from "@/stores/rootStore";
import { useUserById } from "@/hooks/tanstack/useUsers";
import UserProfileHeader from "@/components/users/UserProfileHeader";
import UserDetails from "@/components/users/UserDetails";
import UserEditButton from "@/components/users/UserEditButton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const UserDetailPage = observer(() => {
	const { id } = useParams<{ id: string }>();
	const authStore = useAuthStore();
	const uiStore = useUIStore();

	const { data: user, isLoading, error } = useUserById(id as string);

	// Update page metadata when user data is available
	useEffect(() => {
		if (user) {
			uiStore.setPageMetadata({
				title: `User: ${user.username}`,
				description: "User profile and information",
				breadcrumbs: [
					{ label: "Dashboard", path: "/" },
					{ label: "Users", path: "/users" },
					{ label: user.username },
				],
			});
		} else {
			uiStore.setPageMetadata({
				title: "User Details",
				breadcrumbs: [
					{ label: "Dashboard", path: "/" },
					{ label: "Users", path: "/users" },
					{ label: "Details" },
				],
			});
		}
	}, [user, uiStore]);

	// Use MobX for UI permissions
	const canEdit = authStore.isAdmin || authStore.user?.id === Number(id);

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-12 w-3/4" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					Error loading user data. Please try again later.
				</AlertDescription>
			</Alert>
		);
	}

	if (!user) {
		return (
			<Alert>
				<AlertDescription>User not found.</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			<UserProfileHeader user={user} canEdit={canEdit} />
			<UserDetails user={user} />
			{canEdit && <UserEditButton userId={user.id} />}
		</div>
	);
});

export default UserDetailPage;
