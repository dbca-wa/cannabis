/**
 * CertificateDocument — renders a single certificate document preview for a
 * specific set of drug bags. Mirrors the backend certificate_template.html.
 *
 * Used by WizardPreviewPanel to render one preview per certificate group.
 */

import {
	formatCertificateDate,
	numberToWords,
	formatOfficerLegal,
	formatContentDescription,
} from "@/shared/utils/certificate-format.utils";
import type { OfficerDetails } from "@/shared/utils/certificate-format.utils";

export interface CaseDataBag {
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

interface CertificateDocumentProps {
	caseData: Record<string, unknown>;
	/** The bags covered by this specific certificate */
	bags: CaseDataBag[];
	fonts: { body: string; header: string };
	/** Certificate number, or null to show a pending placeholder */
	certificateNumber?: string | null;
	/** Certified date (ISO), or null to show the pending certification box */
	certifiedDate?: string | null;
	/** Per-certificate Section C notes; falls back to the case notes when omitted */
	notes?: string | null;
}

export const CertificateDocument = ({
	caseData,
	bags,
	fonts,
	certificateNumber = null,
	certifiedDate = null,
	notes = null,
}: CertificateDocumentProps) => {
	const bagCount = bags.length;
	const bagCountWord = numberToWords(bagCount);

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

	const description = formatContentDescription(bags);

	const itemReference = bagCount === 1 ? "the item" : "the items";

	const speciesName =
		bags.find((b) => b.assessment?.determination_display)?.assessment
			?.determination_display ?? null;

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

	const submittingOfficer = formatOfficerLegal(
		caseData.submitting_officer_details as OfficerDetails | null | undefined
	);
	const requestingOfficerDetails = caseData.requesting_officer_id
		? (caseData.requesting_officer_details as OfficerDetails | null | undefined)
		: null;
	const requestingOfficer = formatOfficerLegal(
		requestingOfficerDetails ??
			(caseData.submitting_officer_details as OfficerDetails | null | undefined)
	);

	const receiptDate = formatCertificateDate(
		caseData.received as string | null | undefined
	);
	const additionalNotes =
		notes != null
			? notes.trim() || "None"
			: (caseData.additional_notes as string) || "None";
	const policeReferenceNumber = (caseData.case_number as string) ?? null;
	const approvedBotanist = (caseData.approved_botanist_name as string) ?? null;

	const bagWord = bagCount === 1 ? "bag" : "bags";
	const tagWord = bagCount === 1 ? "number" : "numbers";
	const sealedPhrase =
		bagCount === 1
			? `The item was sealed in a new drug movement bag, tag number`
			: `The items were sealed in new drug movement ${bagWord}, tag ${tagWord}`;
	const handoverPhrase = bagCount === 1 ? "This bag was" : "These bags were";
	const certificationDate = formatCertificateDate(
		certifiedDate ?? new Date().toISOString()
	);

	return (
		<div
			className="mx-auto w-full max-w-[210mm] select-text border border-border bg-white shadow-lg rounded-sm"
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
					{approvedBotanist || (
						<span style={{ color: "#888", fontStyle: "italic" }}>
							[Pending]
						</span>
					)}
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
							{bagWord}, tag {tagWord} {tagNumbers} containing {description}{" "}
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
					style={{ marginLeft: "20px", marginBottom: "8px", fontSize: "14px" }}
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
								{sealedPhrase} {newTagNumbers}. {handoverPhrase} handed over to{" "}
								{requestingOfficer} who was present during the examination.
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
					style={{ marginLeft: "20px", marginBottom: "8px", fontSize: "14px" }}
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

			{/* Certification — matches the generated certificate */}
			<div
				style={{
					background: "#f0f8ff",
					border: "2px solid #2B6493",
					borderRadius: "6px",
					padding: "8px",
					textAlign: "center",
					margin: "15px 0",
				}}
			>
				<div style={{ fontSize: "13px", fontWeight: "bold" }}>
					Certified on{" "}
					<span style={{ color: "#386696" }}>{certificationDate}</span> at the
					<span style={{ color: "#386696" }}> WA Herbarium, Kensington</span>
				</div>
			</div>

			{/* Footer — blank signature line and DBCA details */}
			<div style={{ marginTop: "30px" }}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-end",
						minHeight: "60px",
					}}
				>
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
						<div style={{ marginTop: "10px" }}>
							<img
								src="/assets/images/BCSTransparent.png"
								alt="DBCA Logo"
								style={{ height: "50px", width: "auto", objectFit: "contain" }}
							/>
						</div>
					</div>

					<div
						style={{ textAlign: "right", fontSize: "14px", maxWidth: "300px" }}
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
	);
};
