import AllUsersTable from "@/components/core/users/AllUsersTable";
import DBCAUsersTable from "@/components/core/users/DBCAUsersTable";
import PoliceUsersTable from "@/components/core/users/PoliceUsersTable";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

// import { Form } from "@/components/ui/form";
import { useSearchFilterStore } from "@/stores/rootStore";
import { observer } from "mobx-react";
import { FaUsers } from "react-icons/fa6";
import { GiPoliceOfficerHead } from "react-icons/gi";
import { MdScience } from "react-icons/md";

const Users = observer(() => {
	const searchFilter = useSearchFilterStore();
	const isPoliceFilter = searchFilter.userKindFilter === "Police";
	const isDBCAFilter = searchFilter.userKindFilter === "DBCA";
	const isAllFilter = searchFilter.userKindFilter === "All";

	return (
		<div className="space-y-6">
			{/* Title and Kind Filter */}
			<div className="flex justify-between items-center">
				<div className="flex gap-2 items-center">
					{isDBCAFilter ? (
						<div className="cannabis-green">
							<MdScience size={30} />
						</div>
					) : null}
					{isPoliceFilter ? (
						<div className="text-blue-600">
							<GiPoliceOfficerHead size={30} />
						</div>
					) : null}
					{isAllFilter ? (
						<div className="cannabis-green">
							<FaUsers size={30} />{" "}
						</div>
					) : null}
					<h1 className="text-3xl font-bold">Users</h1>
				</div>
				<div className="flex gap-2">
					<Select
						onValueChange={(value: "All" | "Police" | "DBCA") =>
							searchFilter.setUserKindFilter(value)
						}
						value={searchFilter.userKindFilter}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Filter user kind" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectLabel>Users</SelectLabel>
								<SelectItem value="All">All</SelectItem>
								<SelectItem value="Police">Police</SelectItem>
								<SelectItem value="DBCA">DBCA</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Table, Search & Add */}
			<div>
				{isAllFilter && <AllUsersTable />}
				{isDBCAFilter && <DBCAUsersTable />}
				{isPoliceFilter && <PoliceUsersTable />}
			</div>
		</div>
	);
});

export default Users;
