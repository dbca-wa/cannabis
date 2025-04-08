import { observer } from "mobx-react-lite";
import { useUIStore, useAuthStore } from "@/stores/rootStore";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

const Header = observer(() => {
	const uiStore = useUIStore();
	const authStore = useAuthStore();
	const { title, description, breadcrumbs, actions } = uiStore.pageMetadata;

	const handleLogout = () => {
		authStore.logout();
	};

	return (
		<div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
			<div className="px-6 py-4 flex items-center justify-between">
				<div>
					{/* Title and description */}
					<h1 className="text-2xl font-bold text-slate-900 dark:text-white">
						{title}
					</h1>
					{description && (
						<p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
							{description}
						</p>
					)}

					{/* Breadcrumbs if available */}
					{breadcrumbs && breadcrumbs.length > 0 && (
						<div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mt-2">
							{breadcrumbs.map((crumb, index) => (
								<div key={index} className="flex items-center">
									{index > 0 && (
										<span className="mx-2">/</span>
									)}
									{crumb.path ? (
										<a
											href={crumb.path}
											className="hover:text-blue-500 hover:underline"
										>
											{crumb.label}
										</a>
									) : (
										<span>{crumb.label}</span>
									)}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Right side actions */}
				<div className="flex items-center space-x-3">
					{/* Custom actions from page metadata */}
					{actions && actions.length > 0 && (
						<div className="flex space-x-2">
							{actions.map((action, index) => (
								<Button
									key={index}
									onClick={action.handler}
									variant={
										(action.variant as any) || "default"
									}
									size="sm"
								>
									{action.label}
								</Button>
							))}
						</div>
					)}

					{/* User profile and logout */}
					<div className="flex items-center space-x-1">
						<Button variant="ghost" size="icon" asChild>
							<div className="flex items-center space-x-2 text-sm">
								<User size={18} />
								<span>{authStore.user?.username}</span>
							</div>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleLogout}
							className="text-slate-500 hover:text-red-500"
						>
							<LogOut size={18} />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
});

export default Header;
