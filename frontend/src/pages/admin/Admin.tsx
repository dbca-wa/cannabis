import ContentLayout from "@/shared/components/layout/ContentLayout";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
	Settings,
	Users,
	Database,
	Shield,
	Activity,
	AlertTriangle,
	Server,
	FileText,
} from "lucide-react";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";

const Admin = () => {
	// Breadcrumb configuration
	const breadcrumbs: BreadcrumbItem[] = [
		{
			label: "Admin Panel",
			current: true,
		},
	];

	const adminSections = [
		{
			title: "User Management",
			description: "Manage system users, roles, and permissions",
			icon: <Users className="h-6 w-6" />,
			status: "Active",
			statusColor: "bg-green-500",
		},
		{
			title: "System Settings",
			description: "Configure application settings and preferences",
			icon: <Settings className="h-6 w-6" />,
			status: "Available",
			statusColor: "bg-blue-500",
		},
		{
			title: "Database Management",
			description: "Monitor database health and perform maintenance",
			icon: <Database className="h-6 w-6" />,
			status: "Healthy",
			statusColor: "bg-green-500",
		},
		{
			title: "Security & Audit",
			description: "Review security logs and audit trails",
			icon: <Shield className="h-6 w-6" />,
			status: "Monitoring",
			statusColor: "bg-yellow-500",
		},
		{
			title: "System Monitoring",
			description: "View system performance and health metrics",
			icon: <Activity className="h-6 w-6" />,
			status: "Online",
			statusColor: "bg-green-500",
		},
		{
			title: "Error Logs",
			description: "Review application errors and system issues",
			icon: <AlertTriangle className="h-6 w-6" />,
			status: "2 New",
			statusColor: "bg-red-500",
		},
		{
			title: "Server Status",
			description: "Monitor server health and resource usage",
			icon: <Server className="h-6 w-6" />,
			status: "Running",
			statusColor: "bg-green-500",
		},
		{
			title: "Reports",
			description: "Generate and view system reports",
			icon: <FileText className="h-6 w-6" />,
			status: "Available",
			statusColor: "bg-blue-500",
		},
	];

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="xl">
			<div className="space-y-6">
				{/* Quick Stats */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Users
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">24</div>
							<p className="text-xs text-muted-foreground">
								+2 from last month
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Active Sessions
							</CardTitle>
							<Activity className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">12</div>
							<p className="text-xs text-muted-foreground">
								Currently online
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								System Health
							</CardTitle>
							<Server className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">
								98%
							</div>
							<p className="text-xs text-muted-foreground">
								Uptime this month
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Pending Issues
							</CardTitle>
							<AlertTriangle className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-yellow-600">
								3
							</div>
							<p className="text-xs text-muted-foreground">
								Require attention
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Admin Sections */}
				<div>
					<h2 className="text-xl font-semibold mb-4 dark:text-white">
						Administration Tools
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{adminSections.map((section, index) => (
							<Card
								key={index}
								className="hover:shadow-md transition-shadow cursor-pointer"
							>
								<CardHeader className="pb-3">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="p-2 bg-muted rounded-lg">
												{section.icon}
											</div>
											<div>
												<CardTitle className="text-base">
													{section.title}
												</CardTitle>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<div
												className={`w-2 h-2 rounded-full ${section.statusColor}`}
											/>
											<span className="text-xs text-muted-foreground">
												{section.status}
											</span>
										</div>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<p className="text-sm text-muted-foreground mb-3">
										{section.description}
									</p>
									<Button
										variant="outline"
										size="sm"
										className="w-full dark:text-white!"
									>
										Access Tool
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				</div>

				{/* Recent Activity */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Admin Activity</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
								<Users className="h-4 w-4 text-blue-500" />
								<div className="flex-1">
									<p className="text-sm font-medium">
										New user created
									</p>
									<p className="text-xs text-muted-foreground">
										john.doe@example.com - 2 hours ago
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
								<Settings className="h-4 w-4 text-green-500" />
								<div className="flex-1">
									<p className="text-sm font-medium">
										System settings updated
									</p>
									<p className="text-xs text-muted-foreground">
										Email configuration changed - 4 hours
										ago
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
								<Shield className="h-4 w-4 text-yellow-500" />
								<div className="flex-1">
									<p className="text-sm font-medium">
										Security scan completed
									</p>
									<p className="text-xs text-muted-foreground">
										No issues found - 6 hours ago
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</ContentLayout>
	);
};

export default Admin;
