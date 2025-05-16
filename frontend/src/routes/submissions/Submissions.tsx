import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalTrigger,
} from "@/components/ui/custom/ResponsiveModal";
import { Form } from "@/components/ui/form";
import { Plus } from "lucide-react";

const Submissions = () => {
	return (
		<div className="flex flex-col">
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
						<form>
							<Form></Form>
						</form>
					</ResponsiveModalContent>
				</ResponsiveModal>
			</div>

			{/* Submissions List */}
			<div>List</div>
		</div>
	);
};

export default Submissions;
