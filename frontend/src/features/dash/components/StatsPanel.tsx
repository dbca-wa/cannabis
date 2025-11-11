import { TestTube, AlertCircle } from "lucide-react";
import StatsCard, { type IStatCard } from "./StatsCard";
import { FaMoneyBill } from "react-icons/fa6";
import { Skeleton } from "@/shared/components/ui/skeleton";
import "./Stats.css";
import { FcDocument } from "react-icons/fc";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { useStats } from "../hooks/useStats";

// Loading skeleton for stats cards
const StatsCardSkeleton = () => (
	<div className="dark-foreground-card light-stats-card w-full">
		<div className="stat-top-section">
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-10 w-10 rounded-lg" />
		</div>
		<div className="stat-amount-section">
			<Skeleton className="h-8 w-16" />
		</div>
		<div className="stat-bottom-section">
			<Skeleton className="h-4 w-20" />
			<Skeleton className="h-4 w-20" />
		</div>
	</div>
);

// Error state for stats cards
const StatsCardError = ({ title, error }: { title: string; error: string }) => (
	<div className="dark-foreground-card light-stats-card w-full">
		<div className="stat-top-section">
			<span className="stat-title">{title}</span>
			<div className="stat-icon-container bg-red-900/30 text-red-500">
				<AlertCircle />
			</div>
		</div>
		<div className="stat-amount-section">
			<span className="text-sm text-muted-foreground">Error</span>
		</div>
		<div className="stat-bottom-section">
			<span className="text-xs text-muted-foreground">
				{error.includes("network") ? "Network error" : "Failed to load"}
			</span>
		</div>
	</div>
);

const StatsPanel = () => {
	const { submissions, isLoading: isLoadingSubmissions } = useMySubmissions();
	const {
		certificateStats,
		revenueStats,
		isLoadingCertificates,
		isLoadingRevenue,
		certificateError,
		revenueError,
	} = useStats();

	// My Submissions stats (always available from hook)
	const mySubmissionsData: IStatCard = {
		title: "My Submissions",
		toolTip: "Recent submissions you have been involved in",
		amount: submissions.length,
		amountDenomination: "none",
		monthlyChange: 0, // We don't track historical data for user submissions
		yearlyChange: 0,
		icon: <TestTube />,
		iconBGColour: "bg-blue-900/30",
		iconColour: "text-blue-500",
	};

	// Certificates Issued stats
	const getCertificatesData = (): IStatCard | null => {
		if (!certificateStats) return null;

		return {
			title: "Certificates Issued",
			toolTip: `Total certificates issued in ${certificateStats.current_month.month} ${certificateStats.current_month.year}`,
			amount: certificateStats.current_month.count || 0,
			amountDenomination: "none",
			monthlyChange:
				certificateStats.previous_month?.change_percentage || 0,
			yearlyChange:
				certificateStats.previous_year_same_month?.change_percentage ||
				0,
			icon: <FcDocument />,
			iconBGColour: "bg-purple-900/30",
			iconColour: "text-purple-500",
		};
	};

	// Monthly Revenue stats
	const getRevenueData = (): IStatCard | null => {
		if (!revenueStats) return null;

		return {
			title: "Monthly Revenue",
			toolTip: `Total revenue from invoices in ${revenueStats.current_month.month} ${revenueStats.current_month.year}`,
			amount: revenueStats.current_month.total || 0,
			amountDenomination: "dollar",
			monthlyChange: revenueStats.previous_month?.change_percentage || 0,
			yearlyChange:
				revenueStats.previous_year_same_month?.change_percentage || 0,
			icon: <FaMoneyBill />,
			iconBGColour: "bg-green-900/30",
			iconColour: "text-green-500",
		};
	};

	const certificatesData = getCertificatesData();
	const revenueData = getRevenueData();

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			{/* My Submissions - always show, with loading state */}
			{isLoadingSubmissions ? (
				<StatsCardSkeleton />
			) : (
				<StatsCard {...mySubmissionsData} />
			)}

			{/* Certificates Issued */}
			{isLoadingCertificates ? (
				<StatsCardSkeleton />
			) : certificateError ? (
				<StatsCardError
					title="Certificates Issued"
					error={certificateError}
				/>
			) : certificatesData ? (
				<StatsCard {...certificatesData} />
			) : (
				<StatsCardSkeleton />
			)}

			{/* Monthly Revenue */}
			{isLoadingRevenue ? (
				<StatsCardSkeleton />
			) : revenueError ? (
				<StatsCardError title="Monthly Revenue" error={revenueError} />
			) : revenueData ? (
				<StatsCard {...revenueData} />
			) : (
				<StatsCardSkeleton />
			)}
		</div>
	);
};

export default StatsPanel;
