// Table
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	ColumnDef,
	ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	SortingState,
	useReactTable,
	VisibilityState,
} from "@tanstack/react-table";

// libs
import { Skeleton } from "@/components/ui/skeleton";

// custom
import { usersApi } from "@/api/usersApi";
import { useUsers } from "@/hooks/tanstack/useUsers";
import { User } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ChevronDown, EllipsisVertical } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { MdDelete, MdEdit, MdScience } from "react-icons/md";

import { cn } from "@/lib/utils";
import { CgSmileNone } from "react-icons/cg";
import { FaUserShield } from "react-icons/fa6";
import { GiPoliceOfficerHead } from "react-icons/gi";
import { RiPoliceCarFill } from "react-icons/ri";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { UserTableRow } from "./UserTableRow";

const UsersList = observer(() => {
	const navigate = useNavigate();

	// GET USER DATA ======================================================
	// Fetch data
	const { users: usersQueryData, isLoading, error } = useUsers();
	// useEffect(() => {
	// 	if (!isLoading && usersQueryData) {
	// 		console.log(usersQueryData);
	// 	}
	// }, [isLoading, usersQueryData]);

	// Mutations
	const queryClient = useQueryClient();

	const deleteUserMutation = useMutation({
		mutationFn: usersApi.deleteUser,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["users"] });
		},
	});

	// TABLE DEFINITIIONS ======================================================

	const roleIconMapping = {
		none: <CgSmileNone />,
		police: <GiPoliceOfficerHead />,
		dbca: <MdScience />,
	};

	const columns: ColumnDef<User>[] = [
		{
			accessorKey: "id",
			header: "ID",
			cell: ({ row }) => {
				return <div>{row.getValue("id")}</div>;
			},
		},
		{
			accessorKey: "username",
			header: "Username",
			cell: ({ row }) => {
				return <div>{row.getValue("username")}</div>;
			},
		},
		{
			accessorKey: "email",
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() =>
							column.toggleSorting(column.getIsSorted() === "asc")
						}
					>
						Email
						<ArrowUpDown />
					</Button>
				);
			},
			cell: ({ row }) => {
				return <div className="lowercase">{row.getValue("email")}</div>;
			},
		},
		{
			accessorKey: "role",
			header: () => <div className="text-start">Role</div>,
			cell: ({ row }) => {
				const role = row.getValue("role") as string;
				let formatted =
					roleIconMapping[role as "none" | "dbca" | "police"];

				// console.log(row.original);

				if (row.original.is_superuser) {
					formatted = <FaUserShield />;
				}
				// const formatted = `${role.charAt(0).toUpperCase()}${role.slice(
				// 	1
				// )}`;
				return (
					<div
						className={cn(
							"text-start font-medium ml-1.5",
							role === "dbca"
								? "text-green-600"
								: role === "police"
								? "text-blue-600"
								: row.original.is_superuser
								? "text-yellow-600"
								: "text-black"
						)}
					>
						{formatted}
					</div>
				);
			},
		},
		{
			id: "actions",
			enableHiding: false,
			header: () => <div className="text-center">Actions</div>,
			cell: ({ row }) => {
				const user = row.original;
				const handleDeleteUser = () => {
					navigate(`/users/${user.id}/delete`); // Changes URL to /users/123/delete
				};

				return (
					<div className="space-x-2 text-center">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 p-0">
									<EllipsisVertical />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() => {
										navigate(`/users/${user.id}`); // Changes URL to /users/123
									}}
								>
									<MdEdit className="text-blue-500" />
									Edit
								</DropdownMenuItem>

								<DropdownMenuItem
									onClick={handleDeleteUser}
									disabled={
										// true
										deleteUserMutation.isPending ||
										user.is_superuser
									}
								>
									<div className="">
										<MdDelete className="text-red-700" />
									</div>
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				);
			},
		},
	];

	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] =
		React.useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = React.useState({});
	const data = usersQueryData || [];
	const table = useReactTable({
		data,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	});

	// console.log("Raw usersQueryData:", usersQueryData);
	// console.log("Data being passed to table:", data);
	// console.log("Is data an array?", Array.isArray(data));
	// console.log("Data length:", data?.length);

	// Placeholder while loading
	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array(5)
					.fill(0)
					.map((_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
			</div>
		);
	}

	// Error return
	if (error) {
		return <div>Error loading users</div>;
	}

	// Main Return =============================================================
	return (
		<div className="w-full">
			<div className="flex items-center py-4 justify-between">
				{/* Filter search based on email */}
				<Input
					placeholder="Filter emails..."
					value={
						(table
							.getColumn("email")
							?.getFilterValue() as string) ?? ""
					}
					onChange={(event) =>
						table
							.getColumn("email")
							?.setFilterValue(event.target.value)
					}
					className="max-w-sm"
				/>

				<div className="flex gap-2">
					{/* Select what is presented in the table based on column defs */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" className="ml-auto !h-9">
								Columns <ChevronDown />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{table
								.getAllColumns()
								.filter((column) => column.getCanHide())
								.map((column) => {
									return (
										<DropdownMenuCheckboxItem
											key={column.id}
											className="capitalize"
											checked={column.getIsVisible()}
											onCheckedChange={(value) =>
												column.toggleVisibility(!!value)
											}
										>
											{column.id}
										</DropdownMenuCheckboxItem>
									);
								})}
						</DropdownMenuContent>
					</DropdownMenu>
					{/* <ResponsiveModalTrigger asChild> */}
					<Button
						variant={"police"}
						className=""
						onClick={() => navigate(`/users/add`)}
					>
						<RiPoliceCarFill />
						<span>Add Police</span>
					</Button>
					{/* </ResponsiveModalTrigger> */}
				</div>
			</div>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef
															.header,
														header.getContext()
												  )}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table
								.getRowModel()
								.rows.map((row) => (
									<UserTableRow key={row.id} row={row} />
								))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-end space-x-2 py-4">
				{/* <div className="text-muted-foreground flex-1 text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of{" "}
					{table.getFilteredRowModel().rows.length} row(s) selected.
				</div> */}
				<div className="space-x-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
});

export default UsersList;
