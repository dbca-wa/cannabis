import { useNavigate } from "react-router";
import { MoreHorizontal, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { useBreakpoint } from "@/shared/hooks/ui/useResponsive";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { SubmissionsService } from "@/features/submissions/services/submissions.service";
import { cn } from "@/shared";

const MySubmissionTable = () => {
	const navigate = useNavigate();
	const { isMobile } = useBreakpoint();
	const { submissions, isLoading, error, refetch } = useMySubmissions();

	// Handle navigation to submission details
	const handleViewDetails = (submissionId: number) => {
		navigate(`/submissions/${submissionId}/detail`);
	};

	const handleEdit = (submissionId: number) => {
		navigate(`/submissions/${submissionId}`);
	};

	// Format date for display
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString();
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold">
						My Recent Submissions
					</h3>
				</div>
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-24">Status</TableHead>
								<TableHead>Case Number</TableHead>
								<TableHead>Phase</TableHead>
								{!isMobile && <TableHead>Received</TableHead>}
								<TableHead className="w-16">
									<span className="sr-only">Actions</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Array.from({ length: 3 }).map((_, index) => (
								<TableRow key={index}>
									<TableCell>
										<Skeleton className="h-6 w-16" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-32" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-6 w-24" />
									</TableCell>
									{!isMobile && (
										<TableCell>
											<Skeleton className="h-4 w-20" />
										</TableCell>
									)}
									<TableCell>
										<Skeleton className="h-8 w-8" />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold">
						My Recent Submissions
					</h3>
				</div>
				<div className="rounded-md border p-8">
					<div className="text-center text-muted-foreground">
						<AlertCircle className="mx-auto h-12 w-12 opacity-50 mb-4" />
						<p className="text-lg font-medium mb-2">
							Unable to load submissions
						</p>
						<p className="text-sm mb-4">
							{error.includes("network") ||
							error.includes("fetch")
								? "Please check your internet connection and try again."
								: "There was an error loading your submissions. Please try again later."}
						</p>
						<Button onClick={refetch} variant="outline" size="sm">
							Try Again
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Empty state
	if (submissions.length === 0) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold">
						My Recent Submissions
					</h3>
				</div>
				<div className="rounded-md border p-8">
					<div className="text-center text-muted-foreground">
						<FileText className="mx-auto h-12 w-12 opacity-50 mb-4" />
						<p className="text-lg font-medium mb-2">
							No submissions found
						</p>
						<p className="text-sm mb-4">
							You haven't been assigned to any submissions yet, or
							there are no recent submissions to display.
						</p>
						<Button
							onClick={() => navigate("/submissions")}
							variant="outline"
							size="sm"
						>
							View All Submissions
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Data state
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">My Recent Submissions</h3>
				<Button
					onClick={() => navigate("/submissions")}
					variant="outline"
					size="sm"
				>
					View All
				</Button>
			</div>
			<div className="rounded-md border">
				<Table className="table-light-mode">
					<TableHeader>
						<TableRow>
							<TableHead className="w-24">Status</TableHead>
							<TableHead>Case Number</TableHead>
							<TableHead>Phase</TableHead>
							{!isMobile && <TableHead>Received</TableHead>}
							<TableHead className="w-16">
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{submissions.map((submission) => (
							<TableRow
								key={submission.id}
								className="cursor-pointer hover:bg-muted/50"
								onClick={() => handleViewDetails(submission.id)}
							>
								{/* Status (Draft/Official) */}
								<TableCell>
									<Badge
										variant="default"
										className={cn(
											submission.is_draft
												? "bg-red-100 text-red-800 badge-light-mode"
												: "bg-green-100 text-green-800 badge-light-mode"
										)}
									>
										{submission.is_draft
											? "Draft"
											: "Official"}
									</Badge>
								</TableCell>

								{/* Case Number */}
								<TableCell className="font-mono font-medium">
									{submission.case_number}
								</TableCell>

								{/* Phase */}
								<TableCell>
									<Badge
										className={cn(
											SubmissionsService.getPhaseBadgeClass(
												submission.phase
											),
											"badge-light-mode"
										)}
									>
										{submission.phase_display}
									</Badge>
								</TableCell>

								{/* Received Date - hide on mobile */}
								{!isMobile && (
									<TableCell className="text-sm">
										{formatDate(submission.received)}
									</TableCell>
								)}

								{/* Actions */}
								<TableCell>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												className="h-8 w-8 p-0"
												onClick={(e) =>
													e.stopPropagation()
												}
											>
												<span className="sr-only">
													Open menu
												</span>
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={(e) => {
													e.stopPropagation();
													handleViewDetails(
														submission.id
													);
												}}
											>
												View Details
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={(e) => {
													e.stopPropagation();
													handleEdit(submission.id);
												}}
											>
												Edit
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
};

export default MySubmissionTable;
