import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, XCircle, Clock, CheckCircle, Ban } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import { PageTransition } from "@/shared/components/PageTransition";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { apiClient, ENDPOINTS } from "@/shared/services/api";

interface Invite {
	id: number;
	email: string;
	role: string;
	role_display: string;
	invited_by: {
		id: number;
		email: string;
		full_name: string;
	};
	created_at: string;
	expires_at: string;
	is_valid: boolean;
	is_used: boolean;
	used_at: string | null;
	is_expired: boolean;
	status: "pending" | "used" | "expired" | "revoked";
}

const statusConfig = {
	pending: {
		label: "Pending",
		icon: Clock,
		colour: "bg-amber-100 text-amber-800",
	},
	used: {
		label: "Accepted",
		icon: CheckCircle,
		colour: "bg-emerald-100 text-emerald-800",
	},
	expired: {
		label: "Expired",
		icon: XCircle,
		colour: "bg-gray-100 text-gray-600",
	},
	revoked: { label: "Revoked", icon: Ban, colour: "bg-red-100 text-red-800" },
};

const Invites = () => {
	useDocumentTitle("Invitations");
	const { user } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// Admin-only guard (belt + suspenders — route guard also checks)
	useEffect(() => {
		if (user && !user.is_superuser && !user.is_staff) {
			navigate("/");
		}
	}, [user, navigate]);

	const { data: invites = [], isLoading } = useQuery<Invite[]>({
		queryKey: ["invites"],
		queryFn: () => apiClient.get<Invite[]>(ENDPOINTS.AUTH.INVITES),
	});

	const revokeMutation = useMutation({
		mutationFn: (id: number) =>
			apiClient.post(ENDPOINTS.AUTH.INVITE_REVOKE(id), {}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["invites"] });
			toast.success("Invitation revoked");
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to revoke invitation");
		},
	});

	const [filter, setFilter] = useState<
		"all" | "pending" | "used" | "expired" | "revoked"
	>("all");

	const filtered =
		filter === "all" ? invites : invites.filter((i) => i.status === filter);

	const formatDate = (iso: string) => {
		const d = new Date(iso);
		return d.toLocaleDateString("en-AU", {
			day: "numeric",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<PageTransition>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold">Invitations</h1>
						<p className="text-sm text-muted-foreground">
							Manage user invitations to the system.
						</p>
					</div>
					<Button className="cursor-pointer" onClick={() => navigate("/staff")}>
						<Mail className="h-4 w-4 mr-2" />
						Invite User
					</Button>
				</div>

				{/* Filter tabs */}
				<div className="flex gap-2">
					{(["all", "pending", "used", "expired", "revoked"] as const).map(
						(f) => (
							<Button
								key={f}
								variant={filter === f ? "default" : "outline"}
								size="sm"
								className="cursor-pointer capitalize"
								onClick={() => setFilter(f)}
							>
								{f === "all" ? "All" : f}
								{f !== "all" && (
									<span className="ml-1.5 text-xs opacity-70">
										({invites.filter((i) => i.status === f).length})
									</span>
								)}
							</Button>
						)
					)}
				</div>

				{/* Table */}
				{isLoading ? (
					<div className="text-center py-12 text-muted-foreground">
						Loading invitations...
					</div>
				) : filtered.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground">
						No invitations found.
					</div>
				) : (
					<div className="border rounded-lg">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Email</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Invited By</TableHead>
									<TableHead>Sent</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filtered.map((invite) => {
									const config = statusConfig[invite.status];
									const StatusIcon = config.icon;
									return (
										<TableRow key={invite.id}>
											<TableCell className="font-medium">
												{invite.email}
											</TableCell>
											<TableCell>{invite.role_display}</TableCell>
											<TableCell className="text-muted-foreground">
												{invite.invited_by.full_name}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{formatDate(invite.created_at)}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={`${config.colour} border-0`}
												>
													<StatusIcon className="h-3 w-3 mr-1" />
													{config.label}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												{invite.status === "pending" && (
													<Button
														variant="ghost"
														size="sm"
														className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
														disabled={revokeMutation.isPending}
														onClick={() => revokeMutation.mutate(invite.id)}
													>
														Revoke
													</Button>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</PageTransition>
	);
};

export default Invites;
