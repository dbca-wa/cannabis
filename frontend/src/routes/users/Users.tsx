import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalTrigger,
} from "@/components/ui/custom/ResponsiveModal";
// import { Form } from "@/components/ui/form";
import UsersList from "@/components/users/UsersList";
import { Plus } from "lucide-react";
import { observer } from "mobx-react";

const Users = observer(() => {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold">Users</h1>
				<div>
					{/* User type filter, default All (All, Police, DBCA*/}
					<div>
						{/* If type is police, render police type selector (all, sworn, unsworn) */}

						{/* If type is dbca, render dbca type selector (all, finance, botanist) */}
					</div>
					<ResponsiveModal>
						<ResponsiveModalTrigger asChild>
							<Button>
								<Plus />
								<span>New User</span>
							</Button>
						</ResponsiveModalTrigger>
						<ResponsiveModalContent side={"bottom"}>
							hi
							{/* <form>
								<Form></Form>
							</form> */}
						</ResponsiveModalContent>
					</ResponsiveModal>
				</div>
			</div>
			<UsersList />
		</div>
	);
});

export default Users;
