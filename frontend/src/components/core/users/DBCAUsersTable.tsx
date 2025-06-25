import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalTrigger,
} from "@/components/ui/custom/ResponsiveModal";
import { MdScience } from "react-icons/md";

const DBCAUsersTable = () => {
	return (
		<div>
			<ResponsiveModal>
				<ResponsiveModalTrigger asChild>
					<Button variant={"cannabis"}>
						<MdScience />
						<span>Add DBCA</span>
					</Button>
				</ResponsiveModalTrigger>
				<ResponsiveModalContent side={"bottom"}>
					{/* <form>
								<Form></Form>
							</form> */}
				</ResponsiveModalContent>
			</ResponsiveModal>
			DBCA Users Table
		</div>
	);
};

export default DBCAUsersTable;
