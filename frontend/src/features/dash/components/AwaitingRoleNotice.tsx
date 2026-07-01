import { ShieldQuestion, Mail } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";

/**
 * Shown on the dashboard to authenticated users who have not yet been assigned
 * a role. They cannot access any other part of the app until an existing
 * botanist, finance officer, or administrator gives them a role.
 */
export const AwaitingRoleNotice = () => {
	const { user } = useAuth();
	const name = user?.given_names || user?.full_name || "there";

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-4">
			<Card className="max-w-lg p-8 text-center">
				<div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
					<ShieldQuestion className="h-8 w-8 text-amber-600 dark:text-amber-400" />
				</div>
				<h1 className="text-xl font-semibold tracking-tight">
					Welcome, {name}
				</h1>
				<p className="mt-3 text-sm text-muted-foreground">
					Your account is active but does not have a role yet. Access to cases,
					certificates, batches, and the rest of the app is granted once an
					administrator or an existing team member assigns you a role.
				</p>
				<div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm">
					<Mail className="h-4 w-4 text-muted-foreground" />
					<span className="text-muted-foreground">
						Ask a botanist, finance officer, or administrator to set your role.
					</span>
				</div>
			</Card>
		</div>
	);
};
