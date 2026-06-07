/**
 * Mock certificate preview showing how the botanist's signature
 * appears on the Certificate of Analysis.
 */

interface SignaturePreviewProps {
	signatureUrl: string | null;
	botanistName: string;
}

export const SignaturePreview = ({
	signatureUrl,
	botanistName,
}: SignaturePreviewProps) => {
	return (
		<div className="rounded-xl border border-border bg-card p-6 shadow-sm">
			<h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
				Certificate Preview
			</h2>

			{/* Mock certificate */}
			<div className="rounded-lg border border-border/60 bg-white dark:bg-muted/10 p-5 space-y-5">
				{/* Certificate header */}
				<div className="text-center space-y-1 pb-4 border-b border-border/40">
					<div className="text-xs text-muted-foreground tracking-wide uppercase">
						Department of Biodiversity, Conservation and Attractions
					</div>
					<h3 className="text-base font-semibold tracking-tight text-foreground">
						CERTIFICATE OF ANALYSIS
					</h3>
					<div className="text-[10px] text-muted-foreground">
						Western Australian Herbarium
					</div>
				</div>

				{/* Placeholder case details */}
				<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
					<div>
						<span className="text-muted-foreground">Case No:</span>{" "}
						<span className="font-medium text-foreground/70">2024-001234</span>
					</div>
					<div>
						<span className="text-muted-foreground">Date:</span>{" "}
						<span className="font-medium text-foreground/70">15 Jan 2024</span>
					</div>
					<div>
						<span className="text-muted-foreground">Defendant:</span>{" "}
						<span className="font-medium text-foreground/70">J. Smith</span>
					</div>
					<div>
						<span className="text-muted-foreground">Station:</span>{" "}
						<span className="font-medium text-foreground/70">
							Perth Central
						</span>
					</div>
				</div>

				{/* Signature placement area */}
				<div className="pt-4 border-t border-border/40">
					<div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">
						Authorised Signature
					</div>

					{signatureUrl ? (
						<div
							className="w-full rounded-md border border-border/50 bg-white dark:bg-background overflow-hidden"
							style={{ aspectRatio: "3 / 1" }}
						>
							<img
								src={signatureUrl}
								alt="Digital signature preview"
								className="w-full h-full object-contain"
							/>
						</div>
					) : (
						<div
							className="flex items-center justify-center w-full rounded-md border-2 border-dashed border-border/60 bg-muted/5"
							style={{ aspectRatio: "3 / 1" }}
						>
							<p className="text-xs text-muted-foreground italic">
								Signature will appear here
							</p>
						</div>
					)}

					{/* Botanist name label */}
					<p className="mt-2 text-xs font-medium text-foreground/80">
						{botanistName}
					</p>
					<p className="text-[10px] text-muted-foreground">Approved Botanist</p>
				</div>
			</div>
		</div>
	);
};
