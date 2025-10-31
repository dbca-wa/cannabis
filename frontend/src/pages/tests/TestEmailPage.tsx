// Route for testing new components
import { Head } from "@/shared/components/layout/Head";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	ContentLayout,
	logger,
	SectionWrapper,
	type BreadcrumbItem,
} from "@/shared";
import { toast } from "sonner";
import { sendMandrillTestEmail } from "@/shared/utils/tests.utils";

// Define Zod schema
const mandrillTestEmailSchema = z.object({
	email_address: z.string().email("Invalid email address"),
	first_name: z.string().min(1, "First name is required"),
	last_name: z.string().min(1, "Last name is required"),
	inviter_email: z.string().email("Invalid inviter email address"),
	inviter_first_name: z.string().min(1, "Inviter first name is required"),
	inviter_last_name: z.string().min(1, "Inviter last name is required"),
	invitation_link: z.string().url("Invalid URL"),
	proposed_role: z.string().min(1, "Proposed role is required"),
});

// Type inference from Zod schema
type MandrillTestEmailFormData = z.infer<typeof mandrillTestEmailSchema>;

export const TestEmailPage = () => {
	// React Hook Form setup
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		reset,
	} = useForm<MandrillTestEmailFormData>({
		resolver: zodResolver(mandrillTestEmailSchema),
		defaultValues: {
			email_address: "",
			first_name: "",
			last_name: "",
			inviter_email: "",
			inviter_first_name: "",
			inviter_last_name: "",
			invitation_link: "",
			proposed_role: "",
		},
	});

	const testEmailMutation = useMutation({
		mutationFn: sendMandrillTestEmail,
		onMutate: () => {
			toast.loading("Sending test email...", {
				description: "One moment!",
			});
		},
		onSuccess: async (data) => {
			toast.dismiss();
			toast.success("Success", {
				description: data.message,
			});
			reset(); // Reset form on success
		},
		onError: (error: Error) => {
			logger.error("Failed to send invitation email", { error });
			toast.dismiss();
			toast.error("Could not send test email", {
				description: error.message || "Error sending email",
			});
		},
	});

	const onSubmit = (data: MandrillTestEmailFormData) => {
		testEmailMutation.mutate(data);
	};

	const breadcrumbs: BreadcrumbItem[] = [
		{ label: "Tests", href: "/tests" },
		{ label: "Emails", current: true },
	];
	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			showHomeBreadcrumb={true}
			className="space-y-6"
		>
			<Head title="Email Test" />
			<SectionWrapper>
				<div className="mx-auto max-w-2xl p-6">
					<h1 className="mb-6 text-2xl font-bold">
						Test Mandrill Email
					</h1>

					<form
						onSubmit={handleSubmit(onSubmit)}
						className="space-y-4"
					>
						{/* Recipient Information */}
						<div className="space-y-4 border-b pb-4">
							<h2 className="text-lg font-semibold">
								Recipient Information
							</h2>

							<div>
								<Label htmlFor="email_address">
									Email Address
								</Label>
								<Input
									id="email_address"
									type="email"
									{...register("email_address")}
									placeholder="recipient@example.com"
								/>
								{errors.email_address && (
									<p className="mt-1 text-sm text-red-500">
										{errors.email_address.message}
									</p>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="first_name">
										First Name
									</Label>
									<Input
										id="first_name"
										{...register("first_name")}
										placeholder="John"
									/>
									{errors.first_name && (
										<p className="mt-1 text-sm text-red-500">
											{errors.first_name.message}
										</p>
									)}
								</div>

								<div>
									<Label htmlFor="last_name">Last Name</Label>
									<Input
										id="last_name"
										{...register("last_name")}
										placeholder="Doe"
									/>
									{errors.last_name && (
										<p className="mt-1 text-sm text-red-500">
											{errors.last_name.message}
										</p>
									)}
								</div>
							</div>

							<div>
								<Label htmlFor="proposed_role">
									Proposed Role
								</Label>
								<Input
									id="proposed_role"
									{...register("proposed_role")}
									placeholder="Admin"
								/>
								{errors.proposed_role && (
									<p className="mt-1 text-sm text-red-500">
										{errors.proposed_role.message}
									</p>
								)}
							</div>
						</div>

						{/* Inviter Information */}
						<div className="space-y-4 border-b pb-4">
							<h2 className="text-lg font-semibold">
								Inviter Information
							</h2>

							<div>
								<Label htmlFor="inviter_email">
									Inviter Email
								</Label>
								<Input
									id="inviter_email"
									type="email"
									{...register("inviter_email")}
									placeholder="inviter@example.com"
								/>
								{errors.inviter_email && (
									<p className="mt-1 text-sm text-red-500">
										{errors.inviter_email.message}
									</p>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="inviter_first_name">
										Inviter First Name
									</Label>
									<Input
										id="inviter_first_name"
										{...register("inviter_first_name")}
										placeholder="Jane"
									/>
									{errors.inviter_first_name && (
										<p className="mt-1 text-sm text-red-500">
											{errors.inviter_first_name.message}
										</p>
									)}
								</div>

								<div>
									<Label htmlFor="inviter_last_name">
										Inviter Last Name
									</Label>
									<Input
										id="inviter_last_name"
										{...register("inviter_last_name")}
										placeholder="Smith"
									/>
									{errors.inviter_last_name && (
										<p className="mt-1 text-sm text-red-500">
											{errors.inviter_last_name.message}
										</p>
									)}
								</div>
							</div>
						</div>

						{/* Invitation Link */}
						<div>
							<Label htmlFor="invitation_link">
								Invitation Link
							</Label>
							<Input
								id="invitation_link"
								type="url"
								{...register("invitation_link")}
								placeholder="https://example.com/invite/123"
							/>
							{errors.invitation_link && (
								<p className="mt-1 text-sm text-red-500">
									{errors.invitation_link.message}
								</p>
							)}
						</div>

						<Button
							type="submit"
							disabled={
								isSubmitting || testEmailMutation.isPending
							}
							className="w-full"
						>
							{testEmailMutation.isPending
								? "Sending..."
								: "Send Test Email"}
						</Button>
					</form>
				</div>
			</SectionWrapper>
		</ContentLayout>
	);
};

export default TestEmailPage;
