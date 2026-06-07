import { Head } from "@/shared/components/layout/Head";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Inbox } from "lucide-react";

const TestInvoicePage = () => {
	return (
		<>
			<Head title="Invoice Test" />
			<div className="mb-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => window.history.back()}
					className="cursor-pointer"
				>
					← Back to Tests
				</Button>
			</div>
			<Card className="p-12">
				<div className="flex flex-col items-center justify-center text-muted-foreground">
					<Inbox className="h-10 w-10 opacity-40 mb-3" />
					<p className="text-sm font-medium">Invoice PDF Generation</p>
					<p className="text-xs mt-1">
						Test invoice generation will be available once the email system is
						configured.
					</p>
				</div>
			</Card>
		</>
	);
};

export default TestInvoicePage;
