import { PageHeader } from "@/shared/components/PageHeader";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useNavigate } from "react-router";
import { Card } from "@/shared/components/ui/card";
import { Mail, FileText, Award, PenLine } from "lucide-react";

const TestModule = ({
	href,
	title,
	description,
	icon: Icon,
}: {
	href: string;
	title: string;
	description: string;
	icon: typeof Mail;
}) => {
	const navigate = useNavigate();

	return (
		<Card
			onClick={() => navigate(href)}
			className="p-6 cursor-pointer hover:shadow-md transition-shadow group"
		>
			<div className="flex items-start gap-4">
				<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform">
					<Icon className="w-5 h-5" />
				</div>
				<div>
					<h3 className="text-[14px] font-medium">{title}</h3>
					<p className="text-[12px] text-muted-foreground mt-1">
						{description}
					</p>
				</div>
			</div>
		</Card>
	);
};

const TestsHomePage = () => {
	const { user } = useAuth();
	const isBotanist = user?.role === "botanist";

	return (
		<>
			<PageHeader
				title="Development Tools"
				subtitle="Test email delivery, PDF generation, and certificate workflows."
			/>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				<TestModule
					href="/tests/emails"
					title="Test Emails"
					description="Send test emails to verify delivery and templates."
					icon={Mail}
				/>
				<TestModule
					href="/tests/invoices"
					title="Test Invoices"
					description="Generate test invoice PDFs."
					icon={FileText}
				/>
				<TestModule
					href="/tests/certificates"
					title="Test Certificates"
					description="Generate test certificate PDFs."
					icon={Award}
				/>
				{isBotanist && user && (
					<TestModule
						href={`/users/${user.id}`}
						title="Manage Signature"
						description="Upload or draw your digital signature."
						icon={PenLine}
					/>
				)}
			</div>
		</>
	);
};

export default TestsHomePage;
