import { motion } from "motion/react";
import { AlertCircle, TrendingUp, DollarSign, Inbox } from "lucide-react";
import {
	AreaChart,
	Area,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
	ReferenceLine,
} from "recharts";
import { CountUp } from "@/shared/components/CountUp";
import { PageHeader } from "@/shared/components/PageHeader";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useRevenueStats } from "@/features/dash/hooks/useRevenueStats";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { QuicklinkCards } from "@/features/dash/components/QuicklinkCards";
import { NewCaseButton } from "@/shared/components/NewCaseButton";

/* Financial year runs July to June (Australian FY) */
const CALENDAR_MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
const FY_MONTHS = [
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
];
const currentCalendarMonth = new Date().getMonth(); // 0=Jan
const CURRENT_FY_INDEX = (currentCalendarMonth - 6 + 12) % 12; // 0=Jul, 9=Apr
const currentYear = new Date().getFullYear();
const fyStartYear = currentCalendarMonth >= 6 ? currentYear : currentYear - 1;
const fyLabel = `FY ${fyStartYear}/${String(fyStartYear + 1).slice(2)}`;

const chartData = FY_MONTHS.map((month) => ({
	month,
	cases: null,
	certs: null,
	revenue: null,
	forecastCases: null,
	forecastCerts: null,
	forecastRevenue: null,
}));

/** Custom chart tooltip that filters out forecast data keys */
const ChartTooltipContent = ({
	active,
	payload,
	label,
}: Record<string, unknown>) => {
	if (!active || !Array.isArray(payload)) return null;
	const NAMES: Record<string, string> = {
		cases: "Cases",
		certs: "Certificates",
		revenue: "Revenue",
	};
	const visible = payload.filter(
		(p: Record<string, unknown>) =>
			!String(p.dataKey).startsWith("forecast") && p.value != null
	);
	if (visible.length === 0) return null;
	return (
		<div className="rounded-lg border bg-card p-2.5 shadow-md text-[12px]">
			<div className="text-[11px] text-muted-foreground mb-1.5">
				{String(label)}
			</div>
			{visible.map((entry: Record<string, unknown>) => (
				<div
					key={String(entry.dataKey)}
					className="flex items-center justify-between gap-4"
				>
					<span className="flex items-center gap-1.5">
						<span
							className="w-2 h-2 rounded-full"
							style={{ backgroundColor: String(entry.color) }}
						/>
						{NAMES[String(entry.dataKey)] || String(entry.dataKey)}
					</span>
					<span className="tabular-nums">
						{String(entry.dataKey) === "revenue"
							? `$${Number(entry.value).toLocaleString()}`
							: String(entry.value)}
					</span>
				</div>
			))}
		</div>
	);
};

const Home = () => {
	const { user } = useAuth();
	const {
		data: revenueStats,
		isLoading: isLoadingRevenue,
		isError: isRevenueError,
	} = useRevenueStats();

	const isLoading = isLoadingRevenue;
	const isError = isRevenueError;

	/* Revenue card — current month vs same month last year */
	const currentMonthRevenue = revenueStats?.current_month?.total ?? 0;
	const previousYearSameMonth =
		revenueStats?.previous_year_same_month?.total ?? 0;
	const revenueTarget = previousYearSameMonth;
	const revenueProgress =
		revenueTarget > 0
			? Math.round((currentMonthRevenue / revenueTarget) * 100)
			: 0;
	const yoyChange =
		revenueStats?.previous_year_same_month?.change_percentage ?? null;

	const userName = user?.first_name || user?.full_name || "there";

	return (
		<>
			<PageHeader
				title={`Welcome back, ${userName}`}
				titleClassName="text-3xl font-semibold tracking-tight"
				actions={<NewCaseButton size="lg" />}
			/>

			{isLoading && (
				<div className="space-y-6">
					{/* Stats skeleton */}
					<div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
						<div className="xl:col-span-2 xl:row-span-2">
							<Skeleton className="h-[280px] w-full rounded-xl" />
						</div>
						<Skeleton className="h-[120px] w-full rounded-xl" />
						<Skeleton className="h-[120px] w-full rounded-xl" />
						<Skeleton className="h-[120px] w-full rounded-xl" />
						<Skeleton className="h-[120px] w-full rounded-xl" />
					</div>
					{/* Chart + workflow skeleton */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
						<Skeleton className="lg:col-span-2 h-[380px] w-full rounded-xl" />
						<Skeleton className="h-[380px] w-full rounded-xl" />
					</div>
					{/* Recent cases skeleton */}
					<Skeleton className="h-[300px] w-full rounded-xl" />
				</div>
			)}

			{isError && !isLoading && (
				<Card className="p-12 text-center">
					<AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4 opacity-60" />
					<p className="text-lg font-medium mb-2">
						Failed to load dashboard data
					</p>
					<p className="text-sm text-muted-foreground mb-4">
						Something went wrong while fetching your data. Please try again.
					</p>
					<Button variant="outline" onClick={() => window.location.reload()}>
						Try Again
					</Button>
				</Card>
			)}

			{!isLoading && !isError && (
				/* Real content — single smooth fade-in for the whole dashboard */
				<div className="space-y-6 animate-in fade-in duration-500">
					{/* Mobile: Cards at top */}
					<div className="lg:hidden">
						<QuicklinkCards />
					</div>

					{/* Monthly Revenue — full width */}
					<Card className="group relative overflow-hidden p-6 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 dark:from-emerald-800 dark:via-emerald-700 dark:to-teal-800 text-white border-0 shadow-lg">
						{/* Sheen effect on hover */}
						<div
							className="absolute top-0 -left-full w-full h-full group-hover:animate-sheen pointer-events-none z-10"
							style={{
								background:
									"linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.12) 55%, transparent 70%)",
							}}
						/>
						<div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 dark:bg-white/15 blur-2xl" />
						<div className="absolute -left-10 -bottom-20 w-52 h-52 rounded-full bg-lime-300/20 dark:bg-lime-300/25 blur-3xl" />
						<div className="relative flex flex-col">
							<div className="flex items-start justify-between mb-6">
								<div>
									<div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] bg-white/15 backdrop-blur px-2.5 py-1 rounded-full mb-3">
										<DollarSign className="w-3 h-3" />
										Monthly Revenue
									</div>
									<div className="text-[13px] text-white/80">
										{CALENDAR_MONTHS[currentCalendarMonth]} {currentYear} ·{" "}
										{fyLabel}
									</div>
								</div>
								<div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
									<DollarSign className="w-6 h-6" />
								</div>
							</div>

							<div className="flex-1 flex flex-col justify-center">
								<div className="text-[52px] tracking-tight leading-none">
									<CountUp
										to={currentMonthRevenue}
										prefix="$"
										decimals={0}
										duration={1.6}
									/>
								</div>
								{yoyChange != null && (
									<div className="flex items-center gap-2 text-[13px] text-white/85 mt-3">
										<span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur px-2 py-0.5 rounded-full">
											<TrendingUp className="w-3 h-3" />
											{yoyChange >= 0 ? "+" : ""}
											{Math.round(yoyChange)}% YoY
										</span>
									</div>
								)}
							</div>

							<div className="mt-6 pt-5 border-t border-white/20">
								{revenueTarget > 0 ? (
									<>
										<div className="flex items-center justify-between text-[12px] text-white/85 mb-2">
											<span>
												vs. {CALENDAR_MONTHS[currentCalendarMonth]} last year
											</span>
											<span>
												<CountUp to={revenueProgress} suffix="%" /> of $
												{revenueTarget.toLocaleString()}
											</span>
										</div>
										<div className="h-2 rounded-full bg-white/15 overflow-hidden">
											<motion.div
												initial={{ width: 0 }}
												animate={{
													width: `${Math.min(revenueProgress, 100)}%`,
												}}
												transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
												className="h-full bg-gradient-to-r from-lime-300 to-white rounded-full"
											/>
										</div>
									</>
								) : (
									<div className="text-[12px] text-white/60">
										No comparison data available for{" "}
										{CALENDAR_MONTHS[currentCalendarMonth]} last year
									</div>
								)}
							</div>
						</div>
					</Card>

					{/* Monthly Throughput — full width */}
					<Card className="p-6">
						<div className="mb-4">
							<h3>Monthly Throughput</h3>
							<p className="text-[13px] text-muted-foreground">
								{fyLabel} — cases received, certificates issued, and revenue
								generated each month.
							</p>
						</div>
						{chartData.some(
							(d) => d.cases !== null || d.certs !== null || d.revenue !== null
						) ? (
							<>
								<ResponsiveContainer width="100%" height={290}>
									<AreaChart
										data={chartData}
										margin={{ left: -12, right: 0, top: 20, bottom: 0 }}
									>
										<defs>
											<linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
												<stop
													offset="0%"
													stopColor="#10b981"
													stopOpacity={0.35}
												/>
												<stop
													offset="100%"
													stopColor="#10b981"
													stopOpacity={0}
												/>
											</linearGradient>
											<linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
												<stop
													offset="0%"
													stopColor="#3b82f6"
													stopOpacity={0.25}
												/>
												<stop
													offset="100%"
													stopColor="#3b82f6"
													stopOpacity={0}
												/>
											</linearGradient>
											<linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
												<stop
													offset="0%"
													stopColor="#f59e0b"
													stopOpacity={0.3}
												/>
												<stop
													offset="100%"
													stopColor="#f59e0b"
													stopOpacity={0}
												/>
											</linearGradient>
										</defs>
										<XAxis
											dataKey="month"
											stroke="#9ca3af"
											fontSize={11}
											tickLine={false}
											axisLine={false}
										/>
										<YAxis
											yAxisId="left"
											stroke="#9ca3af"
											fontSize={11}
											tickLine={false}
											axisLine={false}
										/>
										<YAxis
											yAxisId="right"
											orientation="right"
											stroke="#9ca3af"
											fontSize={11}
											tickLine={false}
											axisLine={false}
											tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
										/>
										<Tooltip content={ChartTooltipContent} />
										<Area
											yAxisId="left"
											type="monotone"
											dataKey="cases"
											stroke="#10b981"
											strokeWidth={2}
											fill="url(#sg)"
											connectNulls={false}
										/>
										<Area
											yAxisId="left"
											type="monotone"
											dataKey="certs"
											stroke="#3b82f6"
											strokeWidth={2}
											fill="url(#cg)"
											connectNulls={false}
										/>
										<Area
											yAxisId="right"
											type="monotone"
											dataKey="revenue"
											stroke="#f59e0b"
											strokeWidth={2}
											fill="url(#rg)"
											connectNulls={false}
										/>
										{/* Forecast lines — dashed, lower opacity, no fill */}
										<Area
											yAxisId="left"
											type="monotone"
											dataKey="forecastCases"
											stroke="#10b981"
											strokeWidth={2}
											strokeDasharray="6 4"
											strokeOpacity={0.5}
											fill="none"
											connectNulls={false}
										/>
										<Area
											yAxisId="left"
											type="monotone"
											dataKey="forecastCerts"
											stroke="#3b82f6"
											strokeWidth={2}
											strokeDasharray="6 4"
											strokeOpacity={0.5}
											fill="none"
											connectNulls={false}
										/>
										<Area
											yAxisId="right"
											type="monotone"
											dataKey="forecastRevenue"
											stroke="#f59e0b"
											strokeWidth={2}
											strokeDasharray="6 4"
											strokeOpacity={0.5}
											fill="none"
											connectNulls={false}
										/>
										{/* Current month indicator */}
										<ReferenceLine
											x={FY_MONTHS[CURRENT_FY_INDEX]}
											yAxisId="left"
											stroke="#10b981"
											strokeWidth={1.5}
											strokeDasharray="4 3"
											label={{
												value: "Now",
												position: "top",
												fontSize: 10,
												fill: "#10b981",
												fontWeight: 500,
											}}
										/>
									</AreaChart>
								</ResponsiveContainer>
								<div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-border/40 text-[12px]">
									<span className="flex items-center gap-1.5">
										<span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
										Cases
									</span>
									<span className="flex items-center gap-1.5">
										<span className="w-2 h-2 rounded-full bg-blue-500" />{" "}
										Certificates
									</span>
									<span className="flex items-center gap-1.5">
										<span className="w-2 h-2 rounded-full bg-amber-500" />{" "}
										Revenue
									</span>
									<span className="flex items-center gap-1.5 text-muted-foreground">
										<span className="w-4 h-0 border-t-2 border-dashed border-muted-foreground/50" />{" "}
										Forecast
									</span>
								</div>
								<div className="flex items-center justify-center mt-3 pt-3 border-t border-border/40">
									<div className="text-center">
										<div className="text-[11px] uppercase tracking-wider text-muted-foreground">
											FY Revenue ({fyLabel})
										</div>
										<div className="text-[18px] tracking-tight tabular-nums">
											<CountUp
												to={chartData.reduce(
													(sum, d) => sum + (d.revenue ?? 0),
													0
												)}
												prefix="$"
												decimals={0}
											/>
										</div>
									</div>
								</div>
							</>
						) : (
							<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
								<Inbox className="h-10 w-10 opacity-40 mb-3" />
								<p className="text-sm font-medium">Data unavailable</p>
								<p className="text-xs mt-1">
									Throughput data will appear here as cases are processed.
								</p>
							</div>
						)}
					</Card>

					{/* Desktop: Cards at bottom */}
					<div className="hidden lg:block">
						<QuicklinkCards />
					</div>
				</div>
			)}
		</>
	);
};

export default Home;
