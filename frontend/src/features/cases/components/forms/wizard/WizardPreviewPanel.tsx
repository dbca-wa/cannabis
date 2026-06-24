/* eslint-disable react-refresh/only-export-components */
/**
 * WizardPreviewPanel — Certificate template live preview.
 *
 * Renders case data matching the backend certificate_template.html exactly,
 * including form references, legislation, legal officer formatting, date
 * formatting, section styling, signature area, and DBCA address.
 * Only server-persisted bags (those with a numeric id) are reflected.
 */

import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/shared/utils/style.utils";
import { apiClient } from "@/shared/services/api";
import { ENDPOINTS } from "@/shared/services/api/endpoints";
import { useDrugBagWranglerStore } from "@/app/providers/store.provider";
import {
	formatCertificateDate,
	numberToWords,
	formatOfficerLegal,
	formatContentDescription,
} from "@/shared/utils/certificate-format.utils";
import type { OfficerDetails } from "@/shared/utils/certificate-format.utils";

type FontMode = "aptos" | "aptos-times" | "times";

const FONT_OPTIONS: { value: FontMode; label: string }[] = [
	{ value: "aptos", label: "Aptos" },
	{ value: "aptos-times", label: "Aptos + Times" },
	{ value: "times", label: "Times" },
];

const FONT_FAMILIES: Record<FontMode, { body: string; header: string }> = {
	aptos: {
		body: "'Aptos', 'Calibri', 'Segoe UI', sans-serif",
		header: "'Aptos', 'Calibri', 'Segoe UI', sans-serif",
	},
	"aptos-times": {
		body: "'Aptos', 'Calibri', 'Segoe UI', sans-serif",
		header: "Times, 'Times New Roman', serif",
	},
	times: {
		body: "Times, 'Times New Roman', serif",
		header: "Times, 'Times New Roman', serif",
	},
};

interface WizardPreviewPanelProps {
	caseData: Record<string, unknown> | null;
}

interface CaseDataBag {
	id?: unknown;
	seal_tag_numbers?: string;
	new_seal_tag_numbers?: string | null;
	content_type_display?: string;
	assessment?: {
		determination_display?: string;
		assessment_date?: string | null;
	} | null;
}

interface DefendantDetail {
	last_name?: string;
	given_names?: string | null;
}

/**
 * Shows the signed certificate PDF when the certificate is locked.
 */
const SignedCertificatePreview = ({
	caseId,
	certId,
}: {
	caseId: number;
	certId: number;
}) => {
	const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
	const [pdfError, setPdfError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const fetchPdf = async () => {
			try {
				const blob = await apiClient.getBlob(
					ENDPOINTS.CASES.DOCUMENTS.CERTIFICATE_PDF(caseId, certId)
				);
				if (!cancelled) {
					setPdfBlobUrl(URL.createObjectURL(blob));
				}
			} catch {
				if (!cancelled) {
					setPdfError("Failed to load signed certificate PDF");
				}
			}
		};
		fetchPdf();
		return () => {
			cancelled = true;
			if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [caseId, certId]);

	return (
		<div className="flex flex-col items-center h-full">
			<div
				className="w-full rounded-lg border border-border overflow-hidden shadow-lg"
				style={{ height: "80vh" }}
			>
				{pdfBlobUrl ? (
					<iframe
						src={pdfBlobUrl}
						title="Signed Certificate PDF"
						className="w-full h-full"
						style={{ border: "none" }}
					/>
				) : pdfError ? (
					<div className="flex items-center justify-center h-full">
						<p className="text-red-600">{pdfError}</p>
					</div>
				) : (
					<div className="flex items-center justify-center h-full">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				)}
			</div>
		</div>
	);
};

export const WizardPreviewPanel = observer(function WizardPreviewPanel({
	caseData,
}: WizardPreviewPanelProps) {
	const wrangler = useDrugBagWranglerStore();
	const fontMode = wrangler.state.previewFont;
	const setFontMode = (mode: FontMode) => wrangler.setPreviewFont(mode);

	if (!caseData) {
		return (
			<div
				className="text-center text-muted-foreground p-8"
				style={{ fontFamily: "'Aptos', 'Calibri', 'Segoe UI', sans-serif" }}
			>
				No case data available for preview.
			</div>
		);
	}

	// If the certificate is signed, show the signed PDF instead of the HTML preview
	const certificates = Array.isArray(caseData.certificates)
		? (caseData.certificates as Array<{
				id: number;
				is_locked?: boolean;
				signed_pdf_file?: string | null;
			}>)
		: [];
	const signedCert = certificates.find((c) => c.is_locked && c.signed_pdf_file);

	if (signedCert) {
		return (
			<SignedCertificatePreview
				caseId={(caseData.id as number) ?? 0}
				certId={signedCert.id}
			/>
		);
	}

	const fonts = FONT_FAMILIES[fontMode];

	// Filter to only server-persisted bags (those with a numeric id)
	const allBags = (caseData.bags as CaseDataBag[]) ?? [];
	const bags = allBags.filter((b) => typeof b.id === "number");
	const bagCount = bags.length;
	const bagCountWord = numberToWords(bagCount);

	// Tag numbers
	const tagNumbers =
		bags
			.map((b) => b.seal_tag_numbers)
			.filter(Boolean)
			.join(", ") || "[Pending]";
	const newTagNumbers =
		bags
			.map((b) => b.new_seal_tag_numbers)
			.filter(Boolean)
			.join(", ") || "[Pending]";

	// Content description
	const description = formatContentDescription(bags);

	// Content types for plural logic in section (b)
	const uniqueContentTypes = [
		...new Set(bags.map((b) => b.content_type_display).filter(Boolean)),
	];
	const hasMultipleTypes = uniqueContentTypes.length > 1;
	// Use "the items" if multiple types, otherwise "the {type}" (lowercase)
	const itemReference = hasMultipleTypes
		? "the items"
		: uniqueContentTypes.length === 1
			? `the ${uniqueContentTypes[0]!.toLowerCase()}`
			: "the items";

	// Species / determination
	const speciesName =
		bags.find((b) => b.assessment?.determination_display)?.assessment
			?.determination_display ?? null;

	// Defendants
	const defendantsDetails =
		(caseData.defendants_details as DefendantDetail[]) ?? [];
	const defendantDisplay =
		defendantsDetails.length > 0
			? defendantsDetails
					.map((d) => {
						const surname = (d.last_name ?? "").toUpperCase();
						const given = d.given_names ?? "";
						return given ? `${surname}, ${given}` : surname;
					})
					.join("; ")
			: "UNKNOWN";

	// Officers
	const submittingOfficer = formatOfficerLegal(
		caseData.submitting_officer_details as OfficerDetails | null | undefined
	);
	const requestingOfficer = formatOfficerLegal(
		caseData.requesting_officer_details as OfficerDetails | null | undefined
	);

	// Dates
	const receiptDate = formatCertificateDate(
		caseData.received as string | null | undefined
	);

	// Additional notes — defaults to "None", never "[Pending]"
	const additionalNotes = (caseData.additional_notes as string) || "None";

	// Other case details
	const certificateNumber = (caseData.certificate_number as string) ?? null;
	const policeReferenceNumber = (caseData.case_number as string) ?? null;
	const approvedBotanist = (caseData.approved_botanist_name as string) ?? null;

	// Singular/plural wording
	const bagWord = bagCount === 1 ? "bag" : "bags";
	const tagWord = bagCount === 1 ? "number" : "numbers";

	// Section (b) plural handling — use the actual content type display value (capitalised)
	const contentTypeForText =
		uniqueContentTypes.length === 1 ? uniqueContentTypes[0]! : "items";
	const sealedPhrase =
		bagCount === 1
			? `The ${contentTypeForText} was sealed in a new drug movement bag, tag number`
			: `The ${contentTypeForText} were sealed in new drug movement ${bagWord}, tag ${tagWord}`;
	const handoverPhrase = bagCount === 1 ? "This bag was" : "These bags were";

	// Font toggle index for animation
	const fontIndex = FONT_OPTIONS.findIndex((o) => o.value === fontMode);

	return (
		<div className="flex flex-col items-center">
			{/* Certificate preview */}
			<div
				className="mx-auto w-full max-w-[210mm] border border-border bg-white shadow-lg rounded-sm"
				style={{
					fontFamily: fonts.body,
					fontSize: "12px",
					lineHeight: "1.6",
					padding: "30px",
					color: "#000",
				}}
			>
				{/* Header Section */}
				<header className="relative mb-4" style={{ fontFamily: fonts.header }}>
					{/* Form reference — top left */}
					<div
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							fontSize: "10px",
							color: "#555",
						}}
					>
						<div style={{ fontStyle: "italic" }}>
							Misuse of Drugs Regulations 1982
						</div>
						<div>Schedule 1</div>
					</div>
					{/* Form reference — top right */}
					<div
						style={{
							position: "absolute",
							top: 0,
							right: 0,
							fontSize: "10px",
							color: "#555",
							textAlign: "right",
						}}
					>
						<div>Form M.D.14</div>
					</div>

					{/* Centred content */}
					<div className="text-center" style={{ paddingTop: "30px" }}>
						<div style={{ marginBottom: "5px" }}>
							<div style={{ fontSize: "11px", marginBottom: "3px" }}>
								WESTERN AUSTRALIA
							</div>
							<div style={{ fontSize: "11px", marginBottom: "3px" }}>
								MISUSE OF DRUGS ACT 1981
							</div>
							<div style={{ fontSize: "11px", marginBottom: "0px" }}>
								MISUSE OF DRUGS AMENDMENT ACT 1995
							</div>
						</div>
						<h2
							style={{
								fontSize: "20px",
								fontWeight: "bold",
								textTransform: "uppercase",
								textDecoration: "underline",
								textDecorationThickness: "2px",
								textUnderlineOffset: "4px",
								color: "#1a365d",
								letterSpacing: "1px",
								marginBottom: "8px",
							}}
						>
							Certificate of Approved Botanist
						</h2>
					</div>
				</header>

				{/* Reference Numbers */}
				<div
					style={{
						fontSize: "12px",
						textAlign: "left",
						paddingBottom: "5px",
						marginTop: "10px",
						marginBottom: "10px",
					}}
				>
					<div style={{ padding: "0 5px" }}>
						<strong>Certificate No.</strong>{" "}
						{certificateNumber || (
							<span style={{ color: "#888", fontStyle: "italic" }}>
								[Pending]
							</span>
						)}
					</div>
					<div style={{ padding: "0 5px" }}>
						<strong>Police Reference No.</strong>{" "}
						{policeReferenceNumber || (
							<span style={{ color: "#888", fontStyle: "italic" }}>
								[Pending]
							</span>
						)}
					</div>
				</div>

				{/* Opening Statement */}
				<div
					style={{
						fontSize: "14px",
						marginBottom: "10px",
						padding: "10px 5px 8px 5px",
					}}
				>
					<p>
						I,{" "}
						<strong>
							{approvedBotanist || (
								<span style={{ color: "#888", fontStyle: "italic" }}>
									[Pending]
								</span>
							)}
						</strong>
						, being an approved botanist within the meaning of the{" "}
						<em
							style={{
								color: "#1a365d",
								textDecoration: "underline",
								fontWeight: 500,
							}}
						>
							Misuse of Drugs Act 1981
						</em>{" "}
						and the{" "}
						<em
							style={{
								color: "#1a365d",
								textDecoration: "underline",
								fontWeight: 500,
							}}
						>
							Misuse of Drugs Amendment Act 1995
						</em>
						, hereby certify that:
					</p>
				</div>

				{/* Section (a) — Receipt of Evidence */}
				<section style={{ marginBottom: "10px" }}>
					<div
						style={{
							fontSize: "14px",
							fontWeight: "bold",
							color: "#1a365d",
							marginBottom: "8px",
						}}
					>
						(a) Receipt of Evidence:
					</div>
					<div
						style={{
							fontSize: "14px",
							background: "#f8f9fa",
							padding: "10px",
							borderRadius: "0 4px 4px 0",
							borderLeft: "4px solid #2B6493",
							marginLeft: "20px",
						}}
					>
						{bagCount > 0 ? (
							<p>
								I received for examination {bagCountWord} sealed drug movement{" "}
								{bagWord}, tag {tagWord} {tagNumbers}, containing {description}{" "}
								marked <strong>{defendantDisplay}</strong> from{" "}
								{submittingOfficer} on {receiptDate}.
							</p>
						) : (
							<p style={{ color: "#888", fontStyle: "italic" }}>
								[Pending — add drug bags to populate this section]
							</p>
						)}
					</div>
				</section>

				{/* Section (b) — Examination Results */}
				<section style={{ marginBottom: "10px" }}>
					<div
						style={{
							fontSize: "14px",
							fontWeight: "bold",
							color: "#1a365d",
							marginBottom: "8px",
						}}
					>
						(b) Examination Results:
					</div>
					<div
						style={{
							marginLeft: "20px",
							marginBottom: "8px",
							fontSize: "14px",
						}}
					>
						I examined the material referred to in paragraph (a) of this
						certificate by visual and microscopic examination with the following
						result:
					</div>
					<div
						style={{
							fontSize: "14px",
							background: "#f8f9fa",
							padding: "10px",
							borderRadius: "0 4px 4px 0",
							borderLeft: "4px solid #245554",
							marginLeft: "20px",
						}}
					>
						{bagCount > 0 ? (
							<>
								<p>
									I identified {itemReference} as{" "}
									<em>
										{speciesName || (
											<span style={{ color: "#888" }}>[Pending]</span>
										)}
									</em>
									.
								</p>
								<p style={{ marginTop: "8px" }}>
									{sealedPhrase} <strong>{newTagNumbers}</strong>.{" "}
									{handoverPhrase} handed over to{" "}
									<strong>{requestingOfficer}</strong> who was present during
									the examination.
								</p>
							</>
						) : (
							<p style={{ color: "#888", fontStyle: "italic" }}>
								[Pending — add drug bags to populate this section]
							</p>
						)}
					</div>
				</section>

				{/* Section (c) — Additional Notes */}
				<section style={{ marginBottom: "10px" }}>
					<div
						style={{
							fontSize: "14px",
							fontWeight: "bold",
							color: "#1a365d",
							marginBottom: "8px",
						}}
					>
						(c) Additional Notes:
					</div>
					<div
						style={{
							marginLeft: "20px",
							marginBottom: "8px",
							fontSize: "14px",
						}}
					>
						The following other matters relating to my examination should be
						noted:
					</div>
					<div
						style={{
							fontSize: "14px",
							background: "#f8f9fa",
							padding: "10px",
							borderRadius: "0 4px 4px 0",
							borderLeft: "4px solid #ffc958",
							marginLeft: "20px",
						}}
					>
						<p>{additionalNotes}</p>
					</div>
				</section>

				{/* Certification Box — shown as pending for unsigned version */}
				<div
					style={{
						background: "#fffbeb",
						border: "2px dashed #d97706",
						borderRadius: "6px",
						padding: "8px",
						textAlign: "center",
						margin: "15px 0",
					}}
				>
					<div style={{ fontSize: "12px", color: "#92400e" }}>
						Certification date and signature will be added during Botanist
						Sign-Off (Step 4)
					</div>
				</div>

				{/* Footer — signature and DBCA details */}
				<div style={{ marginTop: "30px" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "flex-end",
							minHeight: "60px",
						}}
					>
						{/* Signature section — left */}
						<div style={{ display: "flex", flexDirection: "column" }}>
							<div style={{ width: "250px" }}>
								<div
									style={{
										borderBottom: "2px solid #000",
										height: "50px",
										marginBottom: "6px",
									}}
								/>
								<div
									style={{
										fontSize: "11px",
										fontWeight: "bold",
										textAlign: "right",
									}}
								>
									Signature of Approved Botanist
								</div>
							</div>
							{/* Logo */}
							<div style={{ marginTop: "10px" }}>
								<img
									src="/assets/images/BCSTransparent.png"
									alt="DBCA Logo"
									style={{
										height: "50px",
										width: "auto",
										objectFit: "contain",
									}}
								/>
							</div>
						</div>

						{/* DBCA details — right */}
						<div
							style={{
								textAlign: "right",
								fontSize: "14px",
								maxWidth: "300px",
							}}
						>
							<div style={{ fontWeight: "bold", marginBottom: "4px" }}>
								Western Australian Herbarium
							</div>
							<div style={{ marginBottom: "1px" }}>
								Department of Biodiversity,
							</div>
							<div style={{ marginBottom: "1px" }}>
								Conservation and Attractions
							</div>
							<div style={{ marginBottom: "1px" }}>Locked Bag 104</div>
							<div style={{ marginBottom: "1px" }}>
								Bentley Delivery Centre, WA 6983
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Font toggle — centred below certificate */}
			<div className="mt-4">
				<div
					role="tablist"
					aria-label="Switch certificate font"
					className="relative inline-flex h-10 items-center justify-center rounded-xl p-1.5 bg-gradient-to-br from-blue-50/90 to-indigo-50/90 dark:from-blue-950/40 dark:to-indigo-950/40 backdrop-blur-xl border border-blue-200/60 dark:border-blue-700/40 shadow-md"
				>
					{/* Animated sliding indicator */}
					<motion.div
						className="absolute h-7 rounded-lg"
						initial={false}
						animate={{
							x: `${fontIndex * 100}%`,
						}}
						transition={{
							type: "spring",
							stiffness: 300,
							damping: 30,
						}}
						style={{
							left: "6px",
							top: "6px",
							width: `calc(${100 / FONT_OPTIONS.length}% - ${12 / FONT_OPTIONS.length}px)`,
							background:
								"linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.2) 100%)",
							border: "1px solid rgba(59, 130, 246, 0.3)",
							boxShadow: "0 4px 16px rgba(59, 130, 246, 0.1)",
						}}
						aria-hidden="true"
					/>

					{FONT_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							role="tab"
							aria-selected={fontMode === option.value}
							onClick={() => setFontMode(option.value)}
							className={cn(
								"relative z-10 inline-flex h-7 min-w-[90px] items-center justify-center rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer",
								fontMode === option.value
									? "text-blue-600 dark:text-blue-400"
									: "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
});
