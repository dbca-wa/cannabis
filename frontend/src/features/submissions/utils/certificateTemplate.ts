import type { CertificateData } from "@/features/submissions/stores/submissionForm.store";

/**
 * Generate HTML for M.D.14 Certificate of Approved Botanist
 * Based on the official Form M.D.14 template from .kiro/reference/certificate_template.html
 *
 * CRITICAL: This template MUST match the backend Django template exactly for WYSIWYG preview
 *
 * @module certificateTemplate
 */

/**
 * Convert number to words for quantity display
 */
function numberToWords(num: number): string {
	const words = [
		"zero",
		"one",
		"two",
		"three",
		"four",
		"five",
		"six",
		"seven",
		"eight",
		"nine",
		"ten",
		"eleven",
		"twelve",
		"thirteen",
		"fourteen",
		"fifteen",
		"sixteen",
		"seventeen",
		"eighteen",
		"nineteen",
		"twenty",
	];

	if (num <= 20) return words[num];
	if (num < 100) {
		const tens = Math.floor(num / 10);
		const ones = num % 10;
		const tensWords = [
			"",
			"",
			"twenty",
			"thirty",
			"forty",
			"fifty",
			"sixty",
			"seventy",
			"eighty",
			"ninety",
		];
		return ones === 0
			? tensWords[tens]
			: `${tensWords[tens]}-${words[ones]}`;
	}
	return num.toString();
}

/**
 * Format content type for display
 */
function formatContentType(contentType: string): string {
	return contentType
		.replace(/_/g, " ")
		.replace(/\b\w/g, (l) => l.toUpperCase());
}

export const generateCertificateHTML = (data: CertificateData): string => {
	const {
		case_number,
		received_date,
		requesting_officer,
		submitting_officer,
		defendants,
		bags,
		total_bags,
		approved_botanist,
	} = data;

	// Format received date
	const formattedDate = received_date
		? new Date(received_date).toLocaleDateString("en-AU", {
				day: "numeric",
				month: "long",
				year: "numeric",
		  })
		: "N/A";

	// Format current date for certification
	const certificationDate = new Date().toLocaleDateString("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	// Format quantity as words (without "a")
	const quantityOfBags = numberToWords(total_bags);

	// Format tag numbers (comma-separated)
	const tagNumbers =
		bags
			.map((b) => b.seal_tag_numbers)
			.filter(Boolean)
			.join(", ") || "N/A";

	// Format description (content types)
	const description =
		bags.length > 0
			? bags.map((b) => formatContentType(b.content_type)).join(", ")
			: "plant material";

	// Format defendants list - "LASTNAME, Given Names" format
	const defendantsList =
		defendants.length > 0
			? defendants
					.map((d) => {
						const lastName = d.last_name?.toUpperCase() || "";
						const firstName = d.first_name || "";
						return firstName
							? `${lastName}, ${firstName}`
							: lastName;
					})
					.join(", ")
			: "Unknown";

	// Format police officer with rank, badge, and name (e.g., "Unsworn Officer PD99456 DELLAR, David")
	const officer = requesting_officer || submitting_officer;
	let policeOfficerWithBadge =
		'<span class="missing-data">Not Assigned</span>';

	if (officer) {
		const rank = officer.rank_display || "Officer";
		const badge = officer.badge_number || "";
		const lastName = officer.last_name?.toUpperCase() || "";
		const firstName = officer.first_name || "";
		const fullName = firstName ? `${lastName}, ${firstName}` : lastName;

		policeOfficerWithBadge = badge
			? `${rank} ${badge} ${fullName}`
			: `${rank} ${fullName}`;
	}

	// Generate examination result (section b) based on bag determinations
	let examinationResult = "";

	// Check if bags have determinations
	const bagsWithDeterminations = bags.filter(
		(b) => b.determination && b.determination !== "pending"
	);

	if (bagsWithDeterminations.length > 0) {
		// Group bags by determination
		const cannabisBags = bagsWithDeterminations.filter(
			(b) =>
				b.determination === "cannabis_sativa" ||
				b.determination === "cannabis_indica" ||
				b.determination === "cannabis_hybrid"
		);
		const nonCannabisBags = bagsWithDeterminations.filter(
			(b) => b.determination === "not_cannabis"
		);
		const unidentifiableBags = bagsWithDeterminations.filter(
			(b) =>
				b.determination === "unidentifiable" ||
				b.determination === "inconclusive" ||
				b.determination === "degraded"
		);

		// Build examination result text
		const results: string[] = [];

		if (cannabisBags.length > 0) {
			const determination =
				cannabisBags[0].determination === "cannabis_indica"
					? "Cannabis indica"
					: cannabisBags[0].determination === "cannabis_hybrid"
					? "Cannabis (hybrid)"
					: "Cannabis sativa";

			// Get new seal tag numbers
			const newTags = cannabisBags
				.map((b) => b.new_seal_tag_numbers)
				.filter(Boolean)
				.join(", ");

			const resealText = newTags
				? ` The plant was resealed in a new drug movement bag, tag numbers ${newTags}.`
				: "";

			// Include officer present during examination
			const officerPresent = requesting_officer
				? `${requesting_officer.rank_display || "Officer"} ${
						requesting_officer.last_name?.toUpperCase() || ""
				  }`
				: "";

			const handoverText = officerPresent
				? ` These bags were handed over to ${officerPresent} who was present during the examination.`
				: "";

			results.push(
				`I identified the plant as ${determination}.${resealText}${handoverText}`
			);
		}

		if (nonCannabisBags.length > 0) {
			const contentType = nonCannabisBags[0].content_type
				? formatContentType(nonCannabisBags[0].content_type)
				: "the contents";
			results.push(`I identified the ${contentType} as not Cannabis.`);
		}

		if (unidentifiableBags.length > 0) {
			const contentType = unidentifiableBags[0].content_type
				? formatContentType(unidentifiableBags[0].content_type)
				: "the contents";
			results.push(`I could not identify the ${contentType}.`);
		}

		examinationResult = results.join(" ");
	} else {
		// No determinations yet - show placeholder
		examinationResult =
			'<span class="missing-data">Botanical assessment pending</span>';
	}

	// Additional notes (section c) - use botanist_notes from first bag or default
	const botanistNotes = bags.find((b) => b.botanist_notes)?.botanist_notes;
	const additionalNotes =
		botanistNotes ||
		'<span class="missing-data">No additional notes</span>';

	// Certificate number - autogenerated by backend
	const certificateNumber = "[AUTOGENERATED]";

	return `
<!DOCTYPE html>
<html>
<head>
    <title>Certificate of Approved Botanist</title>
    <meta charset="utf-8">
    <style>
        @page {
            size: A4;
            margin: 48px;
        }
        
        .certificate-container * {
            box-sizing: border-box;
        }
        
        .certificate-container {
            font-family: Times, 'Times New Roman', serif;
            margin: 0;
            padding: 30px;
            color: #000;
            line-height: 1.6;
            font-size: 12px;
            background: white;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        
        .certificate-container .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .certificate-container .header-section {
            position: relative;
            margin-bottom: 15px;
        }
        
        .certificate-container .form-reference-right {
            position: absolute;
            top: 0;
            right: 0;
            font-size: 10px;
            color: #555;
            text-align: right;
        }
        
        .certificate-container .form-reference-left {
            position: absolute;
            top: 0;
            left: 0;
            font-size: 10px;
            color: #555;
            text-align: left;
        }
        
        .certificate-container .header-center {
            text-align: center;
        }
        
        .certificate-container .certificate-title {
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-decoration: underline;
            text-decoration-thickness: 2px;
            text-underline-offset: 4px;
            margin-bottom: 8px;
            color: #1a365d;
        }
        
        .certificate-container .state-info {
            margin-bottom: 5px;
        }
        
        .certificate-container .state-name {
            font-size: 11px;
            margin-bottom: 3px;
        }
        
        .certificate-container .legislation {
            font-size: 11px;
            margin-bottom: 3px;
        }
        
        .certificate-container .legislation:last-child {
            margin-bottom: 0px;
        }
        
        .certificate-container .reference-numbers {
            padding-bottom: 5px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        
        .certificate-container .reference-number {
            padding: 0 5px;
            font-size: 12px;
            text-align: left;
        }
        
        .certificate-container .reference-number strong {
            font-weight: bold;
        }
        
        .certificate-container .certificate-content {
            text-align: justify;
            font-size: 14px !important;
        }
        
        .certificate-container .opening-statement {
            font-size: 14px;
            margin-bottom: 10px;
            padding: 10px 5px 8px 5px;
        }
        
        .certificate-container .opening-statement strong {
            font-size: 14px;
        }
        
        .certificate-container .legislation-link {
            color: #1a365d;
            text-decoration: underline;
            font-weight: 500;
            font-style: italic;
        }
        
        .certificate-container .certificate-section {
            margin-bottom: 10px;
        }
        
        .certificate-container .section-header {
            font-size: 14px;
            font-weight: bold;
            color: #1a365d;
            margin-bottom: 8px;
        }
        
        .certificate-container .section-intro {
            margin-left: 20px;
            margin-bottom: 8px;
        }
        
        .certificate-container .section-content {
            margin-left: 20px;
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 0 4px 4px 0;
            font-size: 14px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .certificate-container .section-content.blue-border {
            border-left: 4px solid #2B6493;
        }
        
        .certificate-container .section-content.green-border {
            border-left: 4px solid #245554;
        }
        
        .certificate-container .section-content.yellow-border {
            border-left: 4px solid #ffc958;
        }
        
        .certificate-container .bottom-content {
            margin-top: auto;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        .certificate-container .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            min-height: 60px;
            margin-bottom: 10px;
        }
        
        .certificate-container .signature-section {
            display: flex;
            flex-direction: column;
        }
        
        .certificate-container .signature-box {
            width: 250px;
        }
        
        .certificate-container .signature-line {
            border-bottom: 2px solid #000;
            height: 50px;
            margin-bottom: 6px;
        }
        
        .certificate-container .signature-label {
            font-size: 11px;
            font-weight: bold;
            text-align: right;
        }
        
        .certificate-container .footer-logo img {
            height: 50px;
            width: auto;
            object-fit: contain;
        }
        
        .certificate-container .dbca-details {
            text-align: right;
            font-size: 14px;
            max-width: 300px;
        }

        .certificate-container .dbca-details div {
            font-size: 14px;
            margin-bottom: 1px;
        }
        
        .certificate-container .dbca-details .org-name {
            font-weight: bold;
            margin-bottom: 4px;
        }
        
        .certificate-container .certification-box {
            background-color: #f0f8ff;
            border: 2px solid #2B6493;
            border-radius: 6px;
            padding: 6px;
            margin: 15px 0;
            text-align: center;
            width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .certificate-container .cert-date {
            font-size: 13px;
            font-weight: bold;
        }
        
        .certificate-container .cert-highlight {
            color: #386696;
        }
        
        .certificate-container .missing-data {
            background-color: #fef3c7;
            padding: 2px 4px;
            border-radius: 2px;
            font-weight: bold;
        }
        
        @media print {
            .certificate-container .bottom-content {
                page-break-inside: avoid;
            }
            
            .certificate-container .section-content,
            .certificate-container .certification-box {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="certificate-container">
    <div class="main-content">
        <!-- Header Section -->
        <div class="header-section">
            <!-- Form Number and Reference - Top Left -->
            <div class="form-reference-left">
                <div style="font-style: italic">Misuse of Drugs Regulations 1982</div>
                <div>Schedule 1</div>
            </div>
            <!-- Form Number and Reference - Top Right -->
            <div class="form-reference-right">
                <div>Form M.D.14</div>
            </div>

            <!-- Centered Content -->
            <div class="header-center">
                <!-- State and Legislation -->
                <div class="state-info">
                    <div class="state-name">
                        WESTERN AUSTRALIA
                    </div>
                    <div class="legislation">
                        MISUSE OF DRUGS ACT 1981
                    </div>
                    <div class="legislation">
                        MISUSE OF DRUGS AMENDMENT ACT 1995
                    </div>
                </div>
                
                <!-- Certificate Title -->
                <div class="certificate-title">
                    Certificate of Approved Botanist
                </div>
            </div>
        </div>

        <!-- DBCA and Police Reference Numbers -->
        <div class="reference-numbers">
            <div class="reference-number">
                <strong>DBCA Reference No.</strong> ${certificateNumber}
            </div>
            <div class="reference-number">
                <strong>Police Reference No.</strong> ${case_number || "N/A"}
            </div>
        </div>

        <!-- Main Certificate Text -->
        <div class="certificate-content">
            <!-- Opening Statement -->
            <div class="opening-statement">
                I, <strong>${
					approved_botanist?.full_name ||
					'<span class="missing-data">Not Assigned</span>'
				}</strong>, being an approved botanist 
                within the meaning of the 
                <a href="https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_46172.pdf/$FILE/Misuse%20Of%20Drugs%20Act%201981%20-%20%5B08-f0-02%5D.pdf?OpenElement" class="legislation-link">Misuse of Drugs Act 1981</a> 
                and the 
                <a href="https://www.legislation.wa.gov.au/legislation/prod/filestore.nsf/FileURL/mrdoc_6749.pdf/$FILE/Misuse%20of%20Drugs%20Amendment%20Act%201995%20-%20%5B00-00-00%5D.pdf?OpenElement" class="legislation-link">Misuse of Drugs Amendment Act 1995</a>, 
                hereby certify that:
            </div>

            <!-- Section (a) -->
            <div class="certificate-section">
                <div class="section-header">
                    (a) Receipt of Evidence:
                </div>
                <div class="section-content blue-border">
                    I received for examination <strong>${quantityOfBags}</strong> sealed drug
                    movement bag(s), tag number(s) <strong>${tagNumbers}</strong>, containing quantity of 
                    <strong>${description}</strong> marked <strong>${defendantsList}</strong> from 
                    <strong>${policeOfficerWithBadge}</strong> on <strong>${formattedDate}</strong>.
                </div>
            </div>

            <!-- Section (b) -->
            <div class="certificate-section">
                <div class="section-header">
                    (b) Examination Results:
                </div>
                <div class="section-intro">
                    I examined the material referred to in paragraph (a) of
                    this certificate by visual and microscopic examination
                    with the following result:
                </div>
                <div class="section-content green-border">
                    ${examinationResult}
                </div>
            </div>

            <!-- Section (c) -->
            <div class="certificate-section">
                <div class="section-header">
                    (c) Additional Notes:
                </div>
                <div class="section-intro">
                    The following other matters relating to my examination
                    should be noted:
                </div>
                <div class="section-content yellow-border">
                    ${additionalNotes}
                </div>
            </div>
        </div>
        
        <!-- Certification Statement -->
        <div class="certification-box">
            <div class="cert-date">
                Certified on <span class="cert-highlight">${certificationDate}</span> 
                at the<span class="cert-highlight"> WA Herbarium, Kensington</span>
            </div>
        </div>

    </div>

    <!-- Bottom content that will stick to the bottom -->
    <div class="bottom-content">
        
        <!-- Footer Section -->
        <div class="footer-section">
            <!-- Signature section on left -->
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div class="signature-label">
                        Signature of Approved Botanist
                    </div>
                </div>
                <!-- Logo -->
                <div class="footer-logo">
                    <img src="/assets/images/dbca.jpg" alt="DBCA Logo">
                </div>
            </div>

            <!-- DBCA Details on right -->
            <div class="dbca-details">
                <div class="org-name">Western Australian Herbarium</div>
                <div>Department of Biodiversity,</div>
                <div>Conservation and Attractions</div>
                <div>Locked Bag 104</div>
                <div>Bentley Delivery Centre, WA 6983</div>
            </div>
        </div>
    </div>
    </div>
</body>
</html>
    `.trim();
};
