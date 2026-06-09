import { useState } from "react";
import {
	FlaskConical,
	Send,
	CheckCircle2,
	Award,
	FileText,
	Loader2,
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { PageTransition } from "@/shared/components/PageTransition";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/shared/services/api";
import { openBlobInNewTab } from "@/shared/services/pdf/pdf.service";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import { toast } from "sonner";

/** Development tab — email testing, PDF generation tools */
const DevelopmentContent = () => {
	const { user } = useAuth();
	const [recipientUserId, setRecipientUserId] = useState<number | null>(null);
	const [emailTestUserId, setEmailTestUserId] = useState<number | null>(null);
	const [emailTestingMode, setEmailTestingMode] = useState(false);

	const generateTestCertificateMutation = useMutation({
		mutationFn: (variant: string) =>
			apiClient.postBlob(`cases/certificates/test/generate?variant=${variant}`),
		onSuccess: (blob) => {
			openBlobInNewTab(blob);
			toast.success("Test certificate generated");
		},
		onError: (error: Error) => {
			const message = error.message?.includes("<")
				? "Request failed. Please try again."
				: error.message;
			toast.error("Failed to generate test certificate", {
				description: message,
			});
		},
	});

	const generateTestInvoiceMutation = useMutation({
		mutationFn: () => apiClient.postBlob("cases/invoices/test/generate"),
		onSuccess: (blob) => {
			openBlobInNewTab(blob);
			toast.success("Test invoice generated");
		},
		onError: (error: Error) => {
			const message = error.message?.includes("<")
				? "Request failed. Please try again."
				: error.message;
			toast.error("Failed to generate test invoice", { description: message });
		},
	});

	const sendTestEmailMutation = useMutation({
		mutationFn: async () => {
			return apiClient.post<{ message: string; recipient: string }>(
				"communications/test-email/",
				{ recipient_user_id: recipientUserId || user?.id }
			);
		},
		onSuccess: (data) => {
			toast.success("Test email sent", {
				description: `Delivered to ${data.recipient}`,
			});
		},
		onError: (error: Error) => {
			toast.error("Could not send test email", { description: error.message });
		},
	});

	const updateTestingModeMutation = useMutation({
		mutationFn: async (params: {
			email_testing_mode: boolean;
			email_test_user: number | null;
		}) => {
			return apiClient.patch("system/settings/", params);
		},
		onSuccess: () => {
			toast.success("Email testing settings updated");
		},
		onError: (error: Error) => {
			// Sanitise error message — never show raw HTML in toasts
			const message = error.message?.includes("<")
				? "Request failed. Please try again."
				: error.message;
			toast.error("Failed to update", { description: message });
		},
	});

	return (
		<PageTransition>
			<div className="space-y-6">
				{/* Email Testing Mode */}
				<Card className="p-6">
					<div className="flex items-start gap-4 mb-6">
						<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-sm shrink-0">
							<FlaskConical className="w-5 h-5" />
						</div>
						<div className="flex-1">
							<h3 className="text-[14px] font-medium">Email Testing Mode</h3>
							<p className="text-[12px] text-muted-foreground mt-1">
								When enabled, all outgoing emails are redirected to the selected
								test user.
							</p>
						</div>
					</div>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label
									htmlFor="dev-testing-mode"
									className="text-sm font-medium"
								>
									Redirect all emails
								</Label>
								<p className="text-xs text-muted-foreground">
									Emails will show a [TEST] prefix and dark banner
								</p>
							</div>
							<Switch
								id="dev-testing-mode"
								checked={emailTestingMode}
								onCheckedChange={setEmailTestingMode}
								className="data-[state=checked]:bg-emerald-600"
							/>
						</div>
						{emailTestingMode && (
							<div className="space-y-2">
								<Label className="text-sm">
									Test User (receives all emails)
								</Label>
								<UserSearchCombobox
									value={emailTestUserId}
									onValueChange={setEmailTestUserId}
									placeholder="Select test user..."
								/>
							</div>
						)}
						<div className="flex justify-end pt-2">
							<Button
								size="sm"
								onClick={() =>
									updateTestingModeMutation.mutate({
										email_testing_mode: emailTestingMode,
										email_test_user: emailTestingMode ? emailTestUserId : null,
									})
								}
								disabled={updateTestingModeMutation.isPending}
								className="cursor-pointer"
							>
								{updateTestingModeMutation.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								{updateTestingModeMutation.isPending
									? "Saving..."
									: "Save Settings"}
							</Button>
						</div>
					</div>
				</Card>

				{/* Send Test Email */}
				<Card className="p-6">
					<div className="flex items-start gap-4 mb-6">
						<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
							<Send className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-[14px] font-medium">Send Test Email</h3>
							<p className="text-[12px] text-muted-foreground mt-1">
								Send a test email to verify delivery, template rendering, and
								CID logo embedding.
							</p>
						</div>
					</div>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label className="text-sm">Recipient</Label>
							<UserSearchCombobox
								value={recipientUserId}
								onValueChange={setRecipientUserId}
								placeholder="Select recipient (defaults to you)..."
							/>
							<p className="text-xs text-muted-foreground">
								Defaults to your account ({user?.email}) if no user is selected.
							</p>
						</div>
						<Button
							onClick={() => sendTestEmailMutation.mutate()}
							disabled={sendTestEmailMutation.isPending}
							className="w-full cursor-pointer"
						>
							{sendTestEmailMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							{sendTestEmailMutation.isPending
								? "Sending..."
								: "Send Test Email"}
						</Button>
						{sendTestEmailMutation.isSuccess && (
							<div className="flex items-center gap-2 text-sm text-emerald-600">
								<CheckCircle2 className="w-4 h-4" />
								<span>
									Email sent to {sendTestEmailMutation.data?.recipient}
								</span>
							</div>
						)}
					</div>
				</Card>

				{/* Test Tools */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Card className="p-6">
						<div className="flex items-start gap-4">
							<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
								<Award className="w-5 h-5" />
							</div>
							<div>
								<h3 className="text-[14px] font-medium">Test Certificates</h3>
								<p className="text-[12px] text-muted-foreground mt-1">
									Generate test certificate PDFs.
								</p>
								<div className="flex flex-wrap gap-2 mt-3">
									<Button
										size="sm"
										className="cursor-pointer"
										onClick={() =>
											generateTestCertificateMutation.mutate("base")
										}
										disabled={generateTestCertificateMutation.isPending}
									>
										{generateTestCertificateMutation.isPending && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										Base (Times)
									</Button>
									<Button
										size="sm"
										className="cursor-pointer"
										onClick={() =>
											generateTestCertificateMutation.mutate("aptos")
										}
										disabled={generateTestCertificateMutation.isPending}
									>
										Aptos
									</Button>
									<Button
										size="sm"
										className="cursor-pointer"
										onClick={() =>
											generateTestCertificateMutation.mutate("semi_aptos")
										}
										disabled={generateTestCertificateMutation.isPending}
									>
										Semi-Aptos
									</Button>
								</div>
							</div>
						</div>
					</Card>
					<Card className="p-6">
						<div className="flex items-start gap-4">
							<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white flex items-center justify-center shadow-sm shrink-0">
								<FileText className="w-5 h-5" />
							</div>
							<div>
								<h3 className="text-[14px] font-medium">Test Invoices</h3>
								<p className="text-[12px] text-muted-foreground mt-1">
									Generate test invoice PDFs.
								</p>
								<Button
									size="sm"
									className="mt-3 cursor-pointer"
									onClick={() => generateTestInvoiceMutation.mutate()}
									disabled={generateTestInvoiceMutation.isPending}
								>
									{generateTestInvoiceMutation.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									{generateTestInvoiceMutation.isPending
										? "Generating..."
										: "Generate Test Invoice"}
								</Button>
							</div>
						</div>
					</Card>
				</div>
			</div>
		</PageTransition>
	);
};

export default DevelopmentContent;
