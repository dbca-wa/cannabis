import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { User } from "@/types";
import { Row, flexRender } from "@tanstack/react-table";

interface UserTableRowProps {
	row: Row<User>;
}

export const UserTableRow = ({ row }: UserTableRowProps) => {
	return (
		<TableRow
			key={row.id}
			data-state={row.getIsSelected() && "selected"}
			className={cn(
				"border ",
				"hover:bg-transparent dark:hover-transparent"
			)}
		>
			{row.getVisibleCells().map((cell) => {
				// Handle the actions column specially
				// if (cell.column.id === "actions") {
				// 	return (
				// 		<TableCell key={cell.id} className="space-x-2">
				// 			<Button variant="ghost" asChild>
				// 				<Link to={`/users/${user.id}`}>View</Link>
				// 			</Button>
				// 			<Button
				// 				variant="destructive"
				// 				size="sm"
				// 				onClick={handleDeleteUser}
				// 				disabled={
				// 					deleteUserMutation.isPending ||
				// 					user.is_superuser
				// 					// ||
				// 					// user.id === authStore?.user.id
				// 				}
				// 			>
				// 				Delete
				// 			</Button>
				// 		</TableCell>
				// 	);
				// }

				// For all other columns, use the standard flexRender
				return (
					<TableCell key={cell.id}>
						{flexRender(
							cell.column.columnDef.cell,
							cell.getContext()
						)}
					</TableCell>
				);
			})}
		</TableRow>
	);
};
