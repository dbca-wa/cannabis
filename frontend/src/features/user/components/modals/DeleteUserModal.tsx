import { Button } from "@/shared/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalFooter,
} from "@/shared/components/layout/ResponsiveModal";
import { useUsers } from "@/features/user/hooks/useUsers";
import { AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router";

import { Spinner } from "@/shared/components/feedback/Spinner";
import { useUserById } from "@/features/user/hooks/useUserById";

const DeleteUserModal = () => {
	const navigate = useNavigate();
	const { userId } = useParams();

	const { data: user, isLoading } = useUserById(
		userId ? parseInt(userId) : 0
	);
	const { deleteUser, isDeleting } = useUsers();

	const handleClose = () => {
		navigate("/users");
	};

	const handleDelete = async () => {
		if (!userId) return;

		deleteUser(userId, {
			onSuccess: () => {
				handleClose();
			},
			onError: (error) => {
				console.error("Delete error:", error);
				// Error is already handled by the hook (toast), just log here
			},
		});
	};

	// Show loading spinner while fetching user data
	if (isLoading || !user) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<ResponsiveModalContent
					side={"bottom"}
					title="Delete User"
					description="Loading user information..."
				>
					<div className="flex justify-center py-8">
						<Spinner />
					</div>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	const getUserRoleDisplay = () => {
		if (user.role === "botanist") {
			return "Approved Botanist";
		}
		if (user.role === "finance") {
			return "Finance Officer";
		}
		return "No Role";
	};

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side={"bottom"}
				title="Delete User"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					{/* Warning Icon and Message */}
					<div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
						<div>
							<h4 className="font-semibold text-red-800">
								Are you sure you want to delete this user?
							</h4>
							<p className="text-sm text-red-600 mt-1">
								This action is permanent and cannot be undone.
								All user data and associated records will be
								removed.
							</p>
						</div>
					</div>

					{/* User Information */}
					<div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
						<h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
							User Details:
						</h5>
						<div className="grid grid-cols-2 gap-3 text-sm">
							<div>
								<span className="font-medium text-gray-700 dark:text-gray-300">
									Name:
								</span>
								<div className="text-gray-900 dark:text-gray-100">
									{user.full_name}
								</div>
							</div>
							<div>
								<span className="font-medium text-gray-700 dark:text-gray-300">
									Email:
								</span>
								<div className="text-gray-900 dark:text-gray-100">
									{user.email}
								</div>
							</div>
							<div>
								<span className="font-medium text-gray-700 dark:text-gray-300">
									Role:
								</span>
								<div className="text-gray-900 dark:text-gray-100">
									{getUserRoleDisplay()}
								</div>
							</div>
							<div>
								<span className="font-medium text-gray-700 dark:text-gray-300">
									Status:
								</span>
								<div className="flex gap-1">
									{user.is_active ? (
										<span className="text-green-600 dark:text-green-400 text-xs">
											Active
										</span>
									) : (
										<span className="text-red-600 dark:text-red-400 text-xs">
											Inactive
										</span>
									)}
									{user.is_staff && (
										<span className="text-blue-600 dark:text-blue-400 text-xs">
											• Staff
										</span>
									)}
									{user.is_superuser && (
										<span className="text-purple-600 dark:text-purple-400 text-xs">
											• Super Admin
										</span>
									)}
								</div>
							</div>
							{user.employee_id && (
								<div>
									<span className="font-medium text-gray-700 dark:text-gray-300">
										Employee ID:
									</span>
									<div className="text-gray-900 dark:text-gray-100">
										{user.employee_id}
									</div>
								</div>
							)}
							<div>
								<span className="font-medium text-gray-700 dark:text-gray-300">
									Joined:
								</span>
								<div className="text-gray-900 dark:text-gray-100">
									{user.date_joined
										? new Date(
												user.date_joined
										  ).toLocaleDateString()
										: "N/A"}
								</div>
							</div>
						</div>
					</div>

					{/* Additional Warnings for Special Cases */}
					{user.is_superuser && (
						<div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
							<p className="text-sm text-red-800 dark:text-red-200">
								<strong>⚠️ Super Administrator:</strong> This
								user has full system access. Deleting this
								account may severely impact system
								administration.
							</p>
						</div>
					)}

					{user.is_staff && !user.is_superuser && (
						<div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
							<p className="text-sm text-amber-800 dark:text-amber-200">
								<strong>⚠️ Staff Member:</strong> This user has
								administrative privileges. Deleting this account
								may affect system operations.
							</p>
						</div>
					)}

					{user.role === "botanist" && (
						<div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
							<p className="text-sm text-green-800 dark:text-green-200">
								<strong>ℹ️ Botanist:</strong> This user can
								perform botanical determinations. Consider
								reassigning their work before deletion.
							</p>
						</div>
					)}

					{user.role === "finance" && (
						<div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
							<p className="text-sm text-purple-800 dark:text-purple-200">
								<strong>ℹ️ Finance Officer:</strong> This user
								has access to financial features. Ensure
								financial records are properly handled.
							</p>
						</div>
					)}
				</div>

				<ResponsiveModalFooter>
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={isDeleting}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={handleDelete}
						disabled={isDeleting}
					>
						{isDeleting ? "Deleting..." : "Delete User"}
					</Button>
				</ResponsiveModalFooter>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};

export default DeleteUserModal;
