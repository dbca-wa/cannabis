import React, { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Separator } from "@/shared/components/ui/separator";
import {
	Info,
	RefreshCw,
	ChevronDown,
	ChevronRight,
	Server,
	Clock,
	User,
	AlertCircle,
	CheckCircle,
	Settings,
} from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";

import type { SystemSettings } from "@/shared/types/backend-api.types";

interface SystemInfoCardProps {
	settings: SystemSettings;
	onSettingsUpdate: (updatedSettings: SystemSettings) => void;
}

export const SystemInfoCard: React.FC<SystemInfoCardProps> = ({
	settings,
	onSettingsUpdate,
}) => {
	const [expandedSections, setExpandedSections] = useState<
		Record<string, boolean>
	>({
		environment: false,
		audit: false,
	});

	const getEnvironmentBadge = (environment: string) => {
		const envLower = environment.toLowerCase();
		switch (envLower) {
			case "production":
				return (
					<Badge variant="destructive" className="font-semibold">
						Production
					</Badge>
				);
			case "staging":
				return (
					<Badge variant="secondary" className="font-semibold">
						Staging
					</Badge>
				);
			case "development":
				return (
					<Badge
						variant="outline"
						className="font-semibold border-blue-500 text-blue-600"
					>
						Development
					</Badge>
				);
			case "local":
				return (
					<Badge
						variant="outline"
						className="font-semibold border-green-500 text-green-600"
					>
						Local
					</Badge>
				);
			default:
				return (
					<Badge variant="outline" className="font-semibold">
						{environment}
					</Badge>
				);
		}
	};

	const getEnvironmentDescription = (environment: string) => {
		const envLower = environment.toLowerCase();
		switch (envLower) {
			case "production":
				return {
					description:
						"Live production environment serving real users. All changes have immediate impact.",
					icon: <AlertCircle className="h-4 w-4 text-red-500" />,
					behaviors: [
						"Emails sent to actual recipients by default",
						"All settings changes are immediately active",
						"Enhanced security and audit logging",
						"Confirmation required for critical changes",
					],
				};
			case "staging":
				return {
					description:
						"Pre-production environment for testing and validation before deployment.",
					icon: <CheckCircle className="h-4 w-4 text-yellow-500" />,
					behaviors: [
						"Emails sent to admin by default (configurable)",
						"Safe environment for testing changes",
						"Production-like behavior and data",
						"Full feature testing available",
					],
				};
			case "development":
				return {
					description:
						"Development environment for active feature development and testing.",
					icon: <Settings className="h-4 w-4 text-blue-500" />,
					behaviors: [
						"All emails redirected to admin",
						"Debug mode enabled",
						"Hot reloading and development tools",
						"Relaxed security for development",
					],
				};
			case "local":
				return {
					description:
						"Local development environment running on developer machine.",
					icon: <CheckCircle className="h-4 w-4 text-green-500" />,
					behaviors: [
						"All emails redirected to admin",
						"Local database and file storage",
						"Full development tools available",
						"No external service dependencies",
					],
				};
			default:
				return {
					description: "Unknown environment configuration.",
					icon: <Info className="h-4 w-4 text-gray-500" />,
					behaviors: ["Environment-specific behaviors not defined"],
				};
		}
	};

	const formatLastModified = (dateString?: string | null, user?: any) => {
		if (!dateString) {
			return {
				timeAgo: "Never modified",
				fullDate: "No modification date available",
				userDisplay: "Unknown",
			};
		}

		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		let timeAgo = "";
		if (diffDays > 0) {
			timeAgo = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
		} else if (diffHours > 0) {
			timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
		} else if (diffMinutes > 0) {
			timeAgo = `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
		} else {
			timeAgo = "Just now";
		}

		// Prefer email, fallback to full name, then username
		let userDisplay = "Unknown user";
		if (user?.email) {
			userDisplay = user.email;
		} else if (user?.first_name || user?.last_name) {
			userDisplay = `${user.first_name || ""} ${
				user.last_name || ""
			}`.trim();
		} else if (user?.username) {
			userDisplay = user.username;
		}

		return {
			timeAgo,
			fullDate: date.toLocaleString(),
			userDisplay,
		};
	};

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	const environmentInfo = getEnvironmentDescription(settings.environment);
	const lastModifiedInfo = formatLastModified(
		settings.last_modified_at,
		settings.last_modified_by
	);

	return (
		<Card className="transition-all duration-300 hover:shadow-lg">
			<CardHeader>
				<CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
					<div className="flex items-center gap-2">
						<Server className="h-5 w-5" aria-hidden="true" />
						<span id="system-info-heading">System Information</span>
					</div>
					{getEnvironmentBadge(settings.environment)}
				</CardTitle>
				<CardDescription>
					Current system status and environment information
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-6">
					{/* Environment Overview */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 animate-in fade-in-50 slide-in-from-left-2 duration-300">
							{environmentInfo.icon}
							<h3 className="font-medium">Current Environment</h3>
						</div>
						<p className="text-sm text-muted-foreground">
							{environmentInfo.description}
						</p>

						{/* Environment Details - Expandable */}
						<div>
							<Button
								variant="ghost"
								size="sm"
								className="p-0 h-auto font-normal transition-all duration-200 hover:scale-105"
								onClick={() => toggleSection("environment")}
							>
								<div className="flex items-center gap-1">
									{expandedSections.environment ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
									<span className="text-sm text-muted-foreground">
										Environment-specific behaviors
									</span>
								</div>
							</Button>
							{expandedSections.environment && (
								<div className="mt-2 pl-5 space-y-1 animate-in fade-in-50 slide-in-from-top-2 duration-300">
									{environmentInfo.behaviors.map(
										(behavior, index) => (
											<div
												key={index}
												className="flex items-start gap-2"
											>
												<div className="w-1 h-1 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
												<span className="text-sm text-muted-foreground">
													{behavior}
												</span>
											</div>
										)
									)}
								</div>
							)}
						</div>
					</div>

					<Separator />

					{/* Audit Information */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4" />
							<h3 className="font-medium">Last Modified</h3>
						</div>

						{settings.last_modified_at ? (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground">
										Time:
									</span>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="text-sm font-medium cursor-help">
													{lastModifiedInfo.timeAgo}
												</span>
											</TooltipTrigger>
											<TooltipContent>
												<p>
													{lastModifiedInfo.fullDate}
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>

								{settings.last_modified_by && (
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">
											By:
										</span>
										<div className="flex items-center gap-2">
											<User className="h-3 w-3" />
											<span className="text-sm font-medium">
												{lastModifiedInfo.userDisplay}
											</span>
										</div>
									</div>
								)}

								<div>
									<Button
										variant="ghost"
										size="sm"
										className="p-0 h-auto font-normal"
										onClick={() => toggleSection("audit")}
									>
										<div className="flex items-center gap-1">
											{expandedSections.audit ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
											<span className="text-sm text-muted-foreground">
												View audit details
											</span>
										</div>
									</Button>
									{expandedSections.audit && (
										<div className="mt-2 pl-5 space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-muted-foreground">
													Full timestamp:
												</span>
												<span className="font-mono text-xs">
													{lastModifiedInfo.fullDate}
												</span>
											</div>
											{settings.last_modified_by && (
												<>
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															User ID:
														</span>
														<span className="font-mono text-xs">
															{
																settings
																	.last_modified_by
																	.id
															}
														</span>
													</div>
													{settings.last_modified_by
														.email && (
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																Email:
															</span>
															<span className="font-mono text-xs">
																{
																	settings
																		.last_modified_by
																		.email
																}
															</span>
														</div>
													)}
												</>
											)}
										</div>
									)}
								</div>
							</div>
						) : (
							<Alert>
								<Info className="h-4 w-4" />
								<AlertDescription>
									No modification history available. Settings
									may have been initialized automatically.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
