import { Skeleton } from "@/shared/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";

interface TableSkeletonProps {
	columns: number;
	rows?: number;
	showHeader?: boolean;
	className?: string;
}

export function TableSkeleton({
	columns,
	rows = 5,
	showHeader = true,
	className,
}: TableSkeletonProps) {
	return (
		<div className={className}>
			<Table>
				{showHeader && (
					<TableHeader>
						<TableRow>
							{Array.from({ length: columns }).map((_, index) => (
								<TableHead key={index}>
									<Skeleton className="h-4 w-20" />
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
				)}
				<TableBody>
					{Array.from({ length: rows }).map((_, rowIndex) => (
						<TableRow key={rowIndex}>
							{Array.from({ length: columns }).map(
								(_, colIndex) => (
									<TableCell key={colIndex}>
										<Skeleton className="h-4 w-full" />
									</TableCell>
								)
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

// Specialized skeleton for user tables
export function UserTableSkeleton() {
	return <TableSkeleton columns={6} rows={8} className="rounded-md border" />;
}

// Specialized skeleton for police tables
export function PoliceTableSkeleton() {
	return <TableSkeleton columns={6} rows={5} className="rounded-md border" />;
}
