import { useMemo, useCallback, useState } from "react";
import { useNavigate, Link } from "react-router";
import {
	ChevronsUpDown,
	ChevronUp,
	ChevronDown,
	Inbox,
	UserPlus,
	AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { observer } from "mobx-react-lite";

import { PageHeader } from "@/shared/components/PageHeader";
import { PoliceButton } from "@/shared/components/NewCaseButton";
import { PageTransition } from "@/shared/components/PageTransition";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { useUsers } from "@/features/user/hooks/useUsers";
import { StaffFilters } from "@/features/user/components/StaffFilters";
import { staffSearchStore } from "@/app/stores/derived/staff-search.store";
import { cn } from "@/shared/utils/style.utils";

import type { UserRole } from "@/shared/types/backend-api.types";

function getRoleBadge(user: { is_superuser: boolean; role: string }): {
	label: string;
	classes: string;
} {
	if (user.is_superuser) {
		return {
			label: "Admin",
			classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
		};
	}
	switch (user.role) {
		case "botanist":
			return {
				label: "Botanist",
				classes:
					"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
			};
		case "finance":
			return {
				label: "Finance",
				classes:
					"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
			};
		default:
			return {
				label: "No Role",
				classes:
					"bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
			};
	}
}

const Staff = observer(() => {
	const navigate = useNavigate();

	// Invite dialog state
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<UserRole>("botanist");

	// Sort state
	const [sortField, setSortField] = useState("full_name");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

	// Build search params from store state
	const searchParams = useMemo(
		() => ({
			query: staffSearchStore.state.searchTerm || undefined,
			role:
				staffSearchStore.state.filters.role !== "all"
					? (staffSearchStore.state.filters.role as UserRole | "all")
					: "all",
			status:
				staffSearchStore.state.filters.status !== "all"
					? staffSearchStore.state.filters.status
					: "all",
		}),
		[]
	);

	const { users, isLoading, isError, inviteUser, isInviting, refreshUsers } =
		useUsers(searchParams);

	// Client-side filtering for status (active/inactive)
	const filteredUsers = useMemo(() => {
		let result = users;
		if (staffSearchStore.state.filters.status !== "all") {
			result = result.filter((u) =>
				staffSearchStore.state.filters.status === "active"
					? u.is_active
					: !u.is_active
			);
		}
		// Client-side sorting
		const sorted = [...result].sort((a, b) => {
			let aVal: string | number = "";
			let bVal: string | number = "";
			switch (sortField) {
				case "full_name":
					aVal = (a.full_name || "").toLowerCase();
					bVal = (b.full_name || "").toLowerCase();
					break;
				case "role":
					aVal = a.role || "";
					bVal = b.role || "";
					break;
				case "cases_count":
					aVal = a.cases_count ?? 0;
					bVal = b.cases_count ?? 0;
					break;
			}
			if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
			if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});
		return sorted;
	}, [users, sortField, sortDirection]);

	// Sorting
	const handleSort = (field: string) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("asc");
		}
	};

	const getSortIcon = (field: string) => {
		if (sortField === field) {
			return sortDirection === "asc" ? (
				<ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
			) : (
				<ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
			);
		}
		return (
			<ChevronsUpDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
		);
	};

	// Invite handler
	const handleInvite = useCallback(() => {
		if (!inviteEmail.trim()) {
			toast.error("Please enter an email address");
			return;
		}
		inviteUser(
			{
				external_user_data: {
					id: 0,
					employee_id: "",
					given_name: "",
					surname: "",
					email: inviteEmail.trim(),
					full_name: inviteEmail.trim(),
				},
				role: inviteRole,
			},
			{
				onSuccess: () => {
					setInviteOpen(false);
					setInviteEmail("");
					setInviteRole("botanist");
				},
			}
		);
	}, [inviteEmail, inviteRole, inviteUser]);

	return (
		<>
			<PageHeader
				title={`Staff (${filteredUsers.length})`}
				subtitle="Approved botanists, finance officers, and administrators."
				actions={
					<PoliceButton
						to="/staff/add"
						label="Add Staff"
						siren={false}
						size="lg"
					/>
				}
			/>

			<PageTransition className="space-y-4">
				{/* Staff Filters */}
				<StaffFilters />

				{/* Staff Table */}
				<div className="rounded-xl border border-border shadow-md overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("full_name")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Name</span>
										{getSortIcon("full_name")}
									</button>
								</TableHead>
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("role")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Role</span>
										{getSortIcon("role")}
									</button>
								</TableHead>
								<TableHead className="text-center">
									<button
										type="button"
										onClick={() => handleSort("cases_count")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Cases</span>
										{getSortIcon("cases_count")}
									</button>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								Array.from({ length: 5 }).map((_, i) => (
									<TableRow key={i}>
										<TableCell>
											<div className="space-y-1">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-40" />
											</div>
										</TableCell>
										<TableCell>
											<Skeleton className="h-5 w-16 rounded-full" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-6 w-8 rounded-full mx-auto" />
										</TableCell>
									</TableRow>
								))
							) : isError ? (
								<TableRow>
									<TableCell colSpan={3} className="h-48 text-center">
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											<AlertCircle className="h-12 w-12 opacity-50 mb-4" />
											<p className="text-lg font-medium mb-2">
												Unable to load staff
											</p>
											<p className="text-sm mb-4">
												There was an error loading the staff list. Please try
												again.
											</p>
											<Button
												onClick={() => refreshUsers()}
												variant="outline"
												size="sm"
											>
												Try Again
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : filteredUsers.length === 0 ? (
								<TableRow>
									<TableCell colSpan={3} className="h-48 text-center">
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											<Inbox className="h-12 w-12 opacity-40 mb-4" />
											<p className="text-lg font-medium mb-2">
												{staffSearchStore.hasActiveFilters
													? "No users match your filters"
													: "No users yet"}
											</p>
											<p className="text-sm mb-4">
												{staffSearchStore.hasActiveFilters
													? "Try adjusting your search or filters."
													: "Get started by inviting your first user."}
											</p>
											{!staffSearchStore.hasActiveFilters && (
												<Button
													size="sm"
													className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
													onClick={() => setInviteOpen(true)}
												>
													<UserPlus className="w-4 h-4 mr-2" />
													Invite User
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							) : (
								filteredUsers.map((u) => {
									const roleBadge = getRoleBadge(u);
									return (
										<TableRow
											key={u.id}
											className="cursor-pointer"
											onClick={(e) => {
												if (e.ctrlKey || e.metaKey) {
													window.open(`/staff/${u.id}`, "_blank");
												} else {
													navigate(`/staff/${u.id}`);
												}
											}}
										>
											<TableCell>
												<Link
													to={`/staff/${u.id}`}
													onClick={(e) => e.stopPropagation()}
													className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline underline-offset-2 transition-colors text-[14px] cursor-pointer"
												>
													{u.full_name}
												</Link>
												<div className="text-[12px] text-muted-foreground">
													{u.email}
												</div>
											</TableCell>
											<TableCell>
												<Badge className={cn("text-[11px]", roleBadge.classes)}>
													{roleBadge.label}
												</Badge>
											</TableCell>
											<TableCell className="text-center">
												<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-full tabular-nums">
													{u.cases_count ?? 0}
												</span>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>
			</PageTransition>

			{/* Invite User Dialog */}
			<Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite user</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Email</Label>
							<Input
								className="mt-1.5"
								placeholder="user@dbca.wa.gov.au"
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
							/>
						</div>
						<div>
							<Label>Role</Label>
							<Select
								value={inviteRole}
								onValueChange={(v) => setInviteRole(v as UserRole)}
							>
								<SelectTrigger className="mt-1.5 cursor-pointer">
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="botanist" className="cursor-pointer">
										Botanist
									</SelectItem>
									<SelectItem value="finance" className="cursor-pointer">
										Finance
									</SelectItem>
									<SelectItem value="none" className="cursor-pointer">
										None
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => setInviteOpen(false)}
							className="cursor-pointer"
						>
							Cancel
						</Button>
						<Button
							className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
							onClick={handleInvite}
							disabled={isInviting}
						>
							{isInviting ? "Sending..." : "Send invite"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
});

export default Staff;
