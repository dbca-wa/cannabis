import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalTrigger,
} from "@/components/ui/custom/ResponsiveModal";
// import { Form } from "@/components/ui/form";
import { Plus } from "lucide-react";
import { observer } from "mobx-react";
import { HiDocumentCurrencyDollar } from "react-icons/hi2";

const Submissions = observer(() => {
	return (
		<div className="flex flex-col">
			<div className="flex justify-between items-center">
				<div className="flex gap-2 items-center">
					<div className="cannabis-green">
						<HiDocumentCurrencyDollar size={30} />
					</div>
					<h1 className="text-3xl font-bold">Submissions</h1>
				</div>
				{/* Add Submission */}
				<div className="flex justify-end">
					<ResponsiveModal>
						<ResponsiveModalTrigger asChild>
							<Button>
								<Plus />
								<span>New Submission</span>
							</Button>
						</ResponsiveModalTrigger>
						<ResponsiveModalContent side={"bottom"}>
							{/* <form>
							<Form></Form>
						</form> */}
							hi
						</ResponsiveModalContent>
					</ResponsiveModal>
				</div>
			</div>

			{/* Submissions List */}
			<div>List</div>
		</div>
	);
});

export default Submissions;
