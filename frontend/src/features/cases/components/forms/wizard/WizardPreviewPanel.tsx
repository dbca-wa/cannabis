import { observer } from "mobx-react-lite";
import { Users, Building2, Package, Scale } from "lucide-react";
import { useCaseFormStore } from "@/features/cases/hooks/useCaseFormStore";

/**
 * WizardPreviewPanel — Live preview of case form data.
 *
 * Observes the CaseFormStore via MobX observer() and renders a real-time
 * summary of the current form state so users can see what they've entered
 * without switching views.
 */
export const WizardPreviewPanel = observer(function WizardPreviewPanel() {
	const store = useCaseFormStore();

	const caseNumber = store.formData.case_number;
	const received = store.formData.received;
	const envelope = store.formData.security_movement_envelope;
	const requestingOfficer =
		store.selectedOfficers.requesting?.full_name ?? null;
	const submittingOfficer =
		store.selectedOfficers.submitting?.full_name ?? null;
	const botanist = store.selectedBotanist?.full_name ?? null;
	const financeOfficer = store.selectedFinanceOfficer?.full_name ?? null;
	const stationName = store.selectedStation?.name ?? null;
	const defendants = store.selectedDefendants.map((d) => d.full_name);
	const bagCount = store.formData.bags.length;
	const contentTypes = [
		...new Set(
			store.formData.bags
				.map((b) => b.content_type)
				.filter((ct) => ct && ct !== "unknown")
		),
	];

	return (
		<div className="space-y-5">
			{/* Case Details */}
			<div className="rounded-lg border shadow-sm p-5">
				<h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
					<Scale className="h-5 w-5 text-muted-foreground" />
					Case Details
				</h3>
				<dl className="space-y-2 text-sm">
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Case Number</dt>
						<dd className="font-medium">
							{caseNumber || (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Received Date</dt>
						<dd className="font-medium">
							{received || (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">
							Security Movement Envelope
						</dt>
						<dd className="font-medium">
							{envelope || (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
				</dl>
			</div>

			{/* Officers */}
			<div className="rounded-lg border shadow-sm p-5">
				<h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
					<Users className="h-5 w-5 text-muted-foreground" />
					Officers
				</h3>
				<dl className="space-y-2 text-sm">
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Requesting Officer</dt>
						<dd className="font-medium">
							{requestingOfficer || (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Submitting Officer</dt>
						<dd className="font-medium">
							{submittingOfficer || (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Approved Botanist</dt>
						<dd className="font-medium">
							{botanist || (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Finance Officer</dt>
						<dd className="font-medium">
							{financeOfficer || (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
				</dl>
			</div>

			{/* Police Station */}
			<div className="rounded-lg border shadow-sm p-5">
				<h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
					<Building2 className="h-5 w-5 text-muted-foreground" />
					Police Station
				</h3>
				<p className="text-sm font-medium">
					{stationName || (
						<span className="text-muted-foreground italic">Not specified</span>
					)}
				</p>
			</div>

			{/* Defendants */}
			<div className="rounded-lg border shadow-sm p-5">
				<h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
					<Users className="h-5 w-5 text-muted-foreground" />
					Defendants
				</h3>
				{defendants.length > 0 ? (
					<ul className="space-y-1 text-sm">
						{defendants.map((name, index) => (
							<li key={index} className="font-medium">
								• {name}
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-muted-foreground italic">Not specified</p>
				)}
			</div>

			{/* Drug Bags Summary */}
			<div className="rounded-lg border shadow-sm p-5">
				<h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
					<Package className="h-5 w-5 text-muted-foreground" />
					Drug Bags
				</h3>
				<dl className="space-y-2 text-sm">
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Total Bags</dt>
						<dd className="font-medium">
							{bagCount > 0 ? (
								bagCount
							) : (
								<span className="text-muted-foreground italic">None added</span>
							)}
						</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-muted-foreground">Content Types</dt>
						<dd className="font-medium">
							{contentTypes.length > 0 ? (
								contentTypes.join(", ")
							) : (
								<span className="text-muted-foreground italic">
									Not specified
								</span>
							)}
						</dd>
					</div>
				</dl>
			</div>
		</div>
	);
});
