import { useState } from "react";
import { Head } from "@/shared/components/layout/Head";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/shared/services/api";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import { Mail, FlaskConical, Send, CheckCircle2 } from "lucide-react";

interface TestEmailResponse {
	message: string;
	recipient: string;
}

const TestEmailPage = () => {
	const { user } = useAuth();
	const [recipientUserId, setRecipientUserId] = useState<number | null>(null);
	const [testingMode, setTestingMode] = useState(false);
	const [testUserId, setTestUserId] = useState<number | null>(null);

	const sendTestEmailMutation = useMutation({
		mutationFn: async () => {
			return apiClient.post<TestEmailResponse>("communications/test-email/", {
				recipient_user_id: recipientUserId || user?.id,
			});
		},
		onSuccess: (data) => {
			toast.success("Test email sent", {
				description: `Delivered to ${data.recipient}`,
			});
		},
		onError: (error: Error) => {
			toast.error("Could not send test email", {
				description: error.message || "Something went wrong",
			});
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
			toast.error("Failed to update settings", {
				description: error.message,
			});
		},
	});

	const handleSaveTestingMode = () => {
		updateTestingModeMutation.mutate({
			email_testing_mode: testingMode,
			email_test_user: testingMode ? testUserId : null,
		});
	};

	return (
		<>
			<Head title="Test Emails" />
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

			<div className="max-w-2xl space-y-6">
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
								<Label htmlFor="testing-mode" className="text-sm font-medium">
									Redirect all emails
								</Label>
								<p className="text-xs text-muted-foreground">
									Emails will show a [TEST] prefix and dark banner
								</p>
							</div>
							<Switch
								id="testing-mode"
								checked={testingMode}
								onCheckedChange={setTestingMode}
								className="data-[state=checked]:bg-emerald-600"
							/>
						</div>

						{testingMode && (
							<div className="space-y-2">
								<Label className="text-sm">
									Test User (receives all emails)
								</Label>
								<UserSearchCombobox
									value={testUserId}
									onValueChange={setTestUserId}
									placeholder="Select test user..."
								/>
							</div>
						)}

						<div className="flex justify-end pt-2">
							<Button
								size="sm"
								onClick={handleSaveTestingMode}
								disabled={updateTestingModeMutation.isPending}
								className="cursor-pointer"
							>
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
							<Mail className="w-5 h-5" />
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
							{sendTestEmailMutation.isPending ? (
								<>Sending...</>
							) : (
								<>
									<Send className="w-4 h-4 mr-2" />
									Send Test Email
								</>
							)}
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

				{/* Email Templates Info */}
				<Card className="p-6">
					<h3 className="text-[14px] font-medium mb-3">Available Templates</h3>
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline">Test Email</Badge>
						<Badge variant="outline">User Invitation</Badge>
						<Badge variant="outline">Password Reset</Badge>
						<Badge variant="outline">Workflow Notification</Badge>
					</div>
					<p className="text-xs text-muted-foreground mt-3">
						All templates use the cannabis branding with CID-embedded logo.
					</p>
				</Card>
			</div>
		</>
	);
};

export default TestEmailPage;
