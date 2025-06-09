import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalTrigger,
} from "@/components/ui/custom/ResponsiveModal";
// import { Form } from "@/components/ui/form";
import { Plus } from "lucide-react";
import { observer } from "mobx-react";

const Organisations = observer(() => {
	return (
		<div className="flex flex-col">
			<div className="w-full flex justify-between items-center">
				<h1 className="text-3xl font-bold">Organisations</h1>

				<ResponsiveModal>
					<ResponsiveModalTrigger asChild>
						<Button>
							<Plus />
							<span>New Organisation</span>
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
	);
});

export default Organisations;
