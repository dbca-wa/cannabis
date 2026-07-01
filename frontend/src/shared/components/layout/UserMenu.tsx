import { useState } from "react";
import { motion } from "motion/react";
import { observer } from "mobx-react-lite";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
	Sparkles,
	Flame,
	Leaf,
	Sun,
	Moon,
	KeyRound,
	LogOut,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUIStore } from "@/app/providers/store.provider";
import { useNavigate } from "react-router";
import { getAppVersion, getAppEnvironment } from "@/shared/utils/version.utils";

const loaders = [
	{ key: "minimal" as const, label: "Minimal", icon: Sparkles },
	{ key: "base" as const, label: "Cannabis", icon: Leaf },
	{ key: "cook" as const, label: "Cooking", icon: Flame },
];

interface UserMenuProps {
	/** @deprecated Variant is no longer used — kept for backward compatibility with ContentLayout */
	variant?: "sidebar" | "breadcrumb";
	className?: string;
}

const UserMenu = observer((_props: UserMenuProps) => {
	const { user, logout } = useAuth();
	const uiStore = useUIStore();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);

	const isDark = uiStore.resolvedTheme === "dark";
	const initials =
		user?.initials || user?.email?.charAt(0).toUpperCase() || "U";
	const displayName = user?.full_name || user?.email || "Unknown User";

	/** Compute display role with superuser suffix. */
	const getDisplayRole = () => {
		const role =
			!user?.role_display || user.role_display === "None"
				? "No Role"
				: user.role_display;
		return user?.is_superuser ? `${role} · Superuser` : role;
	};

	const displayRole = getDisplayRole();

	const handleThemeToggle = () => {
		uiStore.setTheme(isDark ? "light" : "dark");
	};

	const handleLoaderChange = (key: "minimal" | "base" | "cook") => {
		uiStore.setLoader(key);
	};

	const handleChangePassword = () => {
		setOpen(false);
		navigate("/change-password");
	};

	const handleLogout = () => {
		setOpen(false);
		logout();
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
					<div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center text-[13px] font-medium shadow-sm">
						{initials}
					</div>
					<div className="flex-1 min-w-0 text-left">
						<div className="text-[13px] truncate">{displayName}</div>
						<div className="text-[11px] text-muted-foreground truncate">
							{displayRole}
						</div>
					</div>
				</button>
			</PopoverTrigger>

			<PopoverContent
				side="right"
				align="end"
				className="w-72 p-0 overflow-hidden"
			>
				{/* Profile section */}
				<div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-b border-border/60">
					<div className="flex items-center gap-3">
						<div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-medium shadow-sm">
							{initials}
						</div>
						<div className="flex-1 min-w-0">
							<div className="text-[14px]">{displayName}</div>
							<div className="text-[12px] text-muted-foreground truncate">
								{user?.email || ""}
							</div>
							<div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
								{displayRole}
							</div>
						</div>
					</div>
				</div>

				{/* Loader style selector */}
				<div className="p-2">
					<div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
						Loader style
					</div>
					<div className="grid grid-cols-3 gap-1">
						{loaders.map((l) => {
							const isSelected = uiStore.currentLoader === l.key;
							return (
								<button
									key={l.key}
									onClick={() => handleLoaderChange(l.key)}
									className={`relative p-2 rounded-md border text-center transition-colors cursor-pointer ${
										isSelected
											? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
											: "border-border/60 hover:bg-accent"
									}`}
								>
									{isSelected && (
										<motion.div
											layoutId="loader-dot"
											className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500"
										/>
									)}
									<l.icon className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
									<div className="text-[11px]">{l.label}</div>
								</button>
							);
						})}
					</div>
				</div>

				{/* Theme toggle */}
				<div className="border-t border-border/60 p-2">
					<div className="flex items-center justify-between px-2 py-1.5">
						<div className="flex items-center gap-2">
							{isDark ? (
								<Moon className="w-4 h-4 text-muted-foreground" />
							) : (
								<Sun className="w-4 h-4 text-muted-foreground" />
							)}
							<span className="text-[13px]">Theme</span>
						</div>
						<button
							onClick={handleThemeToggle}
							className={`relative h-7 w-14 rounded-full transition-colors cursor-pointer ${
								isDark ? "bg-emerald-600" : "bg-gray-200 dark:bg-muted"
							}`}
						>
							<motion.div
								animate={{ x: isDark ? 28 : 2 }}
								transition={{
									type: "spring",
									stiffness: 500,
									damping: 30,
								}}
								className="absolute top-[2px] w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-[11px]"
							>
								{isDark ? (
									<Moon className="w-3 h-3 text-emerald-600" />
								) : (
									<Sun className="w-3 h-3 text-amber-500" />
								)}
							</motion.div>
						</button>
					</div>
					<div className="px-2 text-[11px] text-muted-foreground">
						Currently using{" "}
						<span className="capitalize">{uiStore.resolvedTheme}</span> mode
					</div>
					<div className="px-2 text-[11px] text-muted-foreground">
						Cannabis Version {getAppVersion()} ({getAppEnvironment()})
					</div>
				</div>

				{/* Actions */}
				<div className="border-t border-border/60 p-2">
					<button
						onClick={handleChangePassword}
						className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent text-[13px] transition-colors cursor-pointer"
					>
						<KeyRound className="w-4 h-4 text-muted-foreground" />
						Change password
					</button>
					<button
						onClick={handleLogout}
						className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-destructive/10 text-destructive dark:text-red-500/80 text-[13px] transition-colors cursor-pointer"
					>
						<LogOut className="w-4 h-4" />
						Log out
					</button>
				</div>
			</PopoverContent>
		</Popover>
	);
});

export default UserMenu;
