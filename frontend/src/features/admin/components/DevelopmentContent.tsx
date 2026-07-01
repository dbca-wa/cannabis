import { useState } from "react";
import { FlaskConical, Award, Loader2, ScanLine, Mail } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { PageTransition } from "@/shared/components/PageTransition";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { openBlobInNewTab } from "@/shared/services/pdf/pdf.service";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import { useSystemSettings } from "@/shared/hooks/data";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { UserRole } from "@/shared/types/backend-api.types";
import { toast } from "sonner";

/** Development tab — feature toggles (OCR), email routing, a live invite-email
 * preview, and a test certificate generator. */
const DevelopmentContent = () => {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const { data: settings } = useSystemSettings();

	const [emailTestUserId, setEmailTestUserId] = useState<number | null>(null);
	const [emailTestingMode, setEmailTestingMode] = useState(false);

	// Test-invite tool state — default recipient is the current user's email.
	const [inviteEmail, setInviteEmail] = useState(user?.email ?? "");
	const [inviteRole, setInviteRole] = useState<UserRole>("botanist");

	const ocrEnabled = settings?.ocr_enabled ?? false;

	const toggleOcrMutation = useMutation({
		mutationFn: (enabled: boolean) =>
			apiClient.patch(ENDPOINTS.SYSTEM.SETTINGS, { ocr_enabled: enabled }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["system"] });
			toast.success("OCR setting updated");
		},
		onError: (error: Error) => {
			toast.error("Failed to update OCR setting", {
				description: error.message?.includes("<") ? undefined : error.message,
			});
		},
	});

	const sendTestInviteMutation = useMutation({
		mutationFn: (params: { email: string; role: UserRole }) =>
			apiClient.post(ENDPOINTS.AUTH.TEST_INVITE_EMAIL, params),
		onSuccess: () => {
			toast.success(`Test invitation email sent to ${inviteEmail}`);
		},
		onError: (error: Error) => {
			toast.error("Failed to send test invitation", {
				description: error.message?.includes("<") ? undefined : error.message,
			});
		},
	});

	const generateTestCertificateMutation = useMutation({
		mutationFn: () =>
			apiClient.postBlob("cases/certificates/test/generate?variant=base"),
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

	const updateTestingModeMutation = useMutation({
		mutationFn: async (params: {
			email_testing_mode: boolean;
			email_test_user: number | null;
		}) => {
			return apiClient.patch(ENDPOINTS.SYSTEM.SETTINGS, params);
		},
		onSuccess: () => {
			toast.success("Email testing settings updated");
		},
		onError: (error: Error) => {
			const message = error.message?.includes("<")
				? "Request failed. Please try again."
				: error.message;
			toast.error("Failed to update", { description: message });
		},
	});

	return (
		<PageTransition>
			<div className="space-y-6">
				{/* OCR feature toggle */}
				<Card className="p-6">
					<div className="flex items-start gap-4">
						<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
							<ScanLine className="w-5 h-5" />
						</div>
						<div className="flex-1">
							<h3 className="text-[14px] font-medium">Priority 3 Form OCR</h3>
							<p className="text-[12px] text-muted-foreground mt-1">
								When enabled, a drag-and-drop upload appears on case creation
								and processing to optionally prefill case data from a scanned
								form.
							</p>
						</div>
						<Switch
							aria-label="Toggle Priority 3 form OCR"
							checked={ocrEnabled}
							disabled={toggleOcrMutation.isPending}
							onCheckedChange={(checked) => toggleOcrMutation.mutate(checked)}
							className="data-[state=checked]:bg-emerald-600"
						/>
					</div>
				</Card>

				{/* Test invitation email */}
				<Card className="p-6">
					<div className="flex items-start gap-4 mb-4">
						<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
							<Mail className="w-5 h-5" />
						</div>
						<div className="flex-1">
							<h3 className="text-[14px] font-medium">Test Invitation Email</h3>
							<p className="text-[12px] text-muted-foreground mt-1">
								Send a live invitation email so you can preview it. No user or
								invitation record is created.
							</p>
						</div>
					</div>
					<div className="space-y-4">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="test-invite-email" className="text-sm">
									Recipient email
								</Label>
								<Input
									id="test-invite-email"
									type="email"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									placeholder="name@dbca.wa.gov.au"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="test-invite-role" className="text-sm">
									Role shown in email
								</Label>
								<Select
									value={inviteRole}
									onValueChange={(v) => setInviteRole(v as UserRole)}
								>
									<SelectTrigger
										id="test-invite-role"
										className="cursor-pointer"
									>
										<SelectValue placeholder="Select role" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="botanist" className="cursor-pointer">
											Botanist
										</SelectItem>
										<SelectItem value="finance" className="cursor-pointer">
											Finance
										</SelectItem>
										<SelectItem value="none" className="cursor-pointer">
											None
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex justify-end">
							<Button
								size="sm"
								className="cursor-pointer"
								disabled={
									sendTestInviteMutation.isPending || !inviteEmail.trim()
								}
								onClick={() =>
									sendTestInviteMutation.mutate({
										email: inviteEmail.trim(),
										role: inviteRole,
									})
								}
							>
								{sendTestInviteMutation.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Send Test Email
							</Button>
						</div>
					</div>
				</Card>

				{/* Email Testing Mode — controls routing of invite/password-reset emails */}
				<Card className="p-6">
					<div className="flex items-start gap-4 mb-6">
						<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-sm shrink-0">
							<FlaskConical className="w-5 h-5" />
						</div>
						<div className="flex-1">
							<h3 className="text-[14px] font-medium">Email Testing Mode</h3>
							<p className="text-[12px] text-muted-foreground mt-1">
								When enabled, system emails (invitations and password resets)
								are redirected to the selected test user.
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

				{/* Test Certificate generator */}
				<Card className="p-6">
					<div className="flex items-start gap-4">
						<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
							<Award className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-[14px] font-medium">Test Certificate</h3>
							<p className="text-[12px] text-muted-foreground mt-1">
								Generate a sample certificate PDF to preview the template.
							</p>
							<Button
								size="sm"
								className="mt-3 cursor-pointer"
								onClick={() => generateTestCertificateMutation.mutate()}
								disabled={generateTestCertificateMutation.isPending}
							>
								{generateTestCertificateMutation.isPending && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Generate Test Certificate
							</Button>
						</div>
					</div>
				</Card>
			</div>
		</PageTransition>
	);
};

export default DevelopmentContent;
