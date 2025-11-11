import type {
	Submission,
	SystemSettings,
} from "@/shared/types/backend-api.types";

interface InvoiceService {
	name: string;
	description?: string;
	quantity: number;
	rate: number;
	line_total: number;
}

interface InvoiceData {
	invoice_id: string;
	issue_date: string;
	due_date: string;
	police_name: string;
	police_id: string;
	case_number: string;
	approved_botanist: string;
	finance_officer: string;
	services: InvoiceService[];
	subtotal: number;
	tax: number;
	tax_rate_percent: string;
	total: number;
	logo_path: string;
	logo_square: string;
	dbca_org_data: {
		name: string;
		address: string;
		city: string;
		state: string;
		zip: string;
		tax_id: string;
		phone: string;
		email: string;
	};
	billed_to: {
		name: string;
		address: string;
		city: string;
		state: string;
		zip: string;
		phone: string;
	};
}

export const generateInvoiceData = (
	submission: Submission,
	systemSettings: SystemSettings
): InvoiceData => {
	// Calculate costs
	const bagCount = submission.bags.length;
	const certificateCount = submission.certificates?.length || 1;

	const certificateFee = parseFloat(systemSettings.cost_per_certificate);
	const bagFee = parseFloat(systemSettings.cost_per_bag);
	const callOutFee = parseFloat(systemSettings.call_out_fee);
	const forensicHourlyRate = parseFloat(
		systemSettings.cost_per_forensic_hour
	);
	const fuelCostPerKm = parseFloat(systemSettings.cost_per_kilometer_fuel);
	const taxRate = parseFloat(systemSettings.tax_percentage) / 100;

	// Build services array
	const services: InvoiceService[] = [];

	// Certificate service
	services.push({
		name: "Certificate of Approved Botanist",
		description: `Botanical identification certificate for case ${submission.case_number}`,
		quantity: certificateCount,
		rate: certificateFee,
		line_total: certificateCount * certificateFee,
	});

	// Bag processing service
	if (bagCount > 0) {
		services.push({
			name: "Drug Bag Processing",
			description: `Processing and identification of ${bagCount} drug bag${
				bagCount > 1 ? "s" : ""
			}`,
			quantity: bagCount,
			rate: bagFee,
			line_total: bagCount * bagFee,
		});
	}

	// Call out fee (always included)
	services.push({
		name: "Call Out Fee",
		description: "Fixed call out fee for service",
		quantity: 1,
		rate: callOutFee,
		line_total: callOutFee,
	});

	// Forensic hours (if specified)
	const forensicHours = parseFloat(submission.forensic_hours || "0");
	if (forensicHours > 0) {
		services.push({
			name: "Forensic Work",
			description: `${forensicHours} hour${
				forensicHours !== 1 ? "s" : ""
			} of forensic examination`,
			quantity: forensicHours,
			rate: forensicHourlyRate,
			line_total: forensicHours * forensicHourlyRate,
		});
	}

	// Fuel cost (if distance specified)
	const fuelDistanceKm = parseFloat(submission.fuel_distance_km || "0");
	if (fuelDistanceKm > 0) {
		services.push({
			name: "Fuel Cost",
			description: `${fuelDistanceKm} km traveled`,
			quantity: fuelDistanceKm,
			rate: fuelCostPerKm,
			line_total: fuelDistanceKm * fuelCostPerKm,
		});
	}

	// Calculate totals
	const subtotal = services.reduce(
		(sum, service) => sum + service.line_total,
		0
	);
	const tax = subtotal * taxRate;
	const total = subtotal + tax;

	// Format dates
	const issueDate = new Date().toLocaleDateString("en-AU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
	const dueDate = new Date(
		Date.now() + 30 * 24 * 60 * 60 * 1000
	).toLocaleDateString("en-AU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});

	// Get officer info
	const officer =
		submission.requesting_officer_details ||
		submission.submitting_officer_details;
	const officerName = officer?.full_name || "Unknown Officer";
	const officerId = officer?.badge_number || "N/A";

	// Get station info
	const station = submission.station_details;

	return {
		invoice_id: `INV${new Date().getFullYear()}-${String(
			submission.id
		).padStart(3, "0")}`,
		issue_date: issueDate,
		due_date: dueDate,
		police_name: officerName,
		police_id: officerId,
		case_number: submission.case_number,
		approved_botanist:
			submission.approved_botanist_details?.full_name || "Not assigned",
		finance_officer:
			submission.finance_officer_details?.full_name || "Not assigned",
		services,
		subtotal,
		tax,
		tax_rate_percent: systemSettings.tax_percentage,
		total,
		logo_path: "/assets/images/dbca.jpg",
		logo_square: "/assets/images/BCSTransparentCropped.png",
		dbca_org_data: {
			name: "Department of Biodiversity, Conservation and Attractions",
			address: "Locked Bag 104",
			city: "Bentley Delivery Centre",
			state: "WA",
			zip: "6983",
			tax_id: "ABN 38 052 249 024",
			phone: "(08) 9219 9000",
			email: "enquiries@dbca.wa.gov.au",
		},
		billed_to: {
			name: station?.name || "Western Australia Police Force",
			address: station?.address || "2 Adelaide Terrace",
			city: "East Perth",
			state: "WA",
			zip: station?.postcode || "6004",
			phone: station?.phone || "(08) 9222 1111",
		},
	};
};

export const generateInvoiceHTML = (data: InvoiceData): string => {
	return `
<!DOCTYPE html>
<html>
<head>
	<title>Invoice</title>
	<meta charset="utf-8" />
	<style>
		.invoice-container {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			margin: 0;
			padding: 48px;
			color: #111;
			line-height: 1.5;
			font-size: 14px;
			background: white;
			display: flex;
			flex-direction: column;
			min-height: 100vh;
		}

		.invoice-container .main-content {
			flex: 1;
			display: flex;
			flex-direction: column;
		}

		.invoice-container #document_header {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 12px;
		}

		.invoice-container #header_left {
			margin-top: -24px;
		}

		.invoice-container #header_left img {
			height: 4rem;
			width: auto;
			object-fit: contain;
		}

		.invoice-container #header_right {
			display: flex;
			flex-direction: column;
			margin-top: -24px;
		}

		.invoice-container .tax-invoice-title {
			text-transform: uppercase;
			font-size: 2.25rem;
			font-weight: 500;
			margin-bottom: 0.25rem;
		}

		.invoice-container .invoice-number {
			color: #6b7280;
			justify-content: flex-end;
			width: 100%;
			text-align: right;
			margin: 0;
		}

		.invoice-container .police-case-info {
			display: flex;
			width: 100%;
			justify-content: space-between;
			margin: 12px 0;
		}

		.invoice-container .police-case-left,
		.invoice-container .police-case-right {
			display: flex;
			flex-direction: column;
		}

		.invoice-container .police-case-right {
			text-align: right;
		}

		.invoice-container .police-case-info div {
			text-transform: uppercase;
		}

		.invoice-container .police-case-info span {
			font-weight: bold;
		}

		.invoice-container .info-section {
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			border-top: 1px solid #d1d5db;
			border-bottom: 1px solid #d1d5db;
			margin: 12px 0 16px 0;
		}

		.invoice-container .info-column {
			display: flex;
			flex-direction: column;
			padding: 1rem;
		}

		.invoice-container .info-column:first-child {
			flex: 1;
			padding-left: 0;
			border-right: 1px solid #d1d5db;
		}

		.invoice-container .info-column:last-child {
			flex: 1;
		}

		.invoice-container .info-column h2 {
			font-size: 0.875rem;
			font-weight: 500;
			margin: 0 0 0.5rem 0;
		}

		.invoice-container .info-column p {
			font-size: 0.875rem;
			color: #6b7280;
			margin: 0;
		}

		.invoice-container .company-name {
			font-weight: 600 !important;
		}

		.invoice-container .table-container {
			margin-top: 1rem;
			flex: 1;
		}

		.invoice-container .invoice-table {
			width: 100%;
			border-collapse: collapse;
			table-layout: fixed;
		}

		.invoice-container .invoice-table thead tr {
			border-bottom: 1px solid #d1d5db;
		}

		.invoice-container .invoice-table th {
			font-size: 0.875rem;
			font-weight: 500;
			color: #111827;
			padding: 0.5rem;
			text-align: left;
			white-space: nowrap;
		}

		.invoice-container .item-col {
			width: 10%;
			padding: 0.5rem 1rem 0.5rem 0;
			text-align: left;
		}

		.invoice-container .service-col {
			width: 45%;
			padding: 0.5rem;
			text-align: left;
		}

		.invoice-container .qty-col {
			width: 10%;
			padding: 0.5rem 1rem 0.5rem 0;
			text-align: center !important;
		}

		.invoice-container .rate-col {
			width: 15%;
			padding: 0.5rem;
			text-align: right !important;
		}

		.invoice-container .total-col {
			width: 20%;
			padding: 0.5rem;
			text-align: right !important;
		}

		.invoice-container .service-row td {
			font-size: 0.875rem;
			color: #111827;
			font-weight: 300;
			vertical-align: top;
			word-wrap: break-word;
		}

		.invoice-container .service-row .item-cell {
			padding: 0.5rem 0.5rem 0.5rem 1rem;
			width: 10%;
		}

		.invoice-container .service-row .service-cell {
			padding: 0;
			width: 45%;
		}

		.invoice-container .service-row .qty-cell {
			padding: 0;
			padding-top: 0.5rem;
			text-align: center !important;
			width: 10%;
		}

		.invoice-container .service-row .rate-cell {
			padding: 0;
			padding-top: 0.5rem;
			text-align: right;
			width: 15%;
		}

		.invoice-container .service-row .total-cell {
			padding: 0;
			padding-top: 0.5rem;
			text-align: right;
			width: 20%;
		}

		.invoice-container .service-row.last-service td {
			padding-bottom: 0.5rem !important;
		}

		.invoice-container .item-number {
			font-weight: bold;
		}

		.invoice-container .service-name {
			font-weight: 500;
			margin-bottom: 0;
			padding-top: 0.5rem;
			display: block;
		}

		.invoice-container .service-description {
			color: #6b7280;
			display: block;
		}

		.invoice-container .table-separator {
			border-bottom: 1px solid #d1d5db;
		}

		.invoice-container .summary-row {
			height: auto;
			width: 100%;
			display: flex;
		}

		.invoice-container .summary-cell {
			width: 100%;
			padding: 0.5rem;
			padding-bottom: 0 !important;
			font-size: 0.875rem;
			text-align: right;
			justify-self: right;
			justify-content: right;
		}

		.invoice-container .summary-label {
			font-weight: 500;
			margin-bottom: 0.25rem;
		}

		.invoice-container .summary-value {
			color: #111827;
			font-weight: 600;
		}

		.invoice-container .footer-section {
			margin-top: auto;
		}

		.invoice-container .footer-info {
			display: flex;
			justify-content: space-between;
			font-size: 0.875rem;
			color: #6b7280;
			padding-left: 0.25rem;
			padding-right: 0.25rem;
		}

		.invoice-container .footer-left {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		.invoice-container .footer-left span {
			font-weight: bold;
		}

		.invoice-container .footer-right {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		.invoice-container .footer-right span {
			font-weight: normal;
		}

		.invoice-container .footer-contacts {
			display: flex;
			align-items: center;
			gap: 2rem;
		}

		.invoice-container .remittance-container {
			margin-top: auto;
			min-height: 200px;
		}

		.invoice-container .dashed-separator {
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 1rem 0;
		}

		.invoice-container .dashed-line {
			border-top: 1px dashed #9ca3af;
			width: 100%;
		}

		.invoice-container .remittance-advice {
			margin-top: -8px;
		}

		.invoice-container #remittance-header {
			margin-bottom: 4px;
			display: flex;
			width: 100%;
			justify-content: space-between;
		}

		.invoice-container #remittance-header-left {
			margin-bottom: 0;
			display: flex;
			gap: 8px;
		}

		.invoice-container #remittance-header-left img {
			margin-top: -8px;
			height: 75px;
			width: 75px;
			object-fit: contain;
		}

		.invoice-container #remittance-header-right {
			margin-bottom: 0;
		}

		.invoice-container .remittance-title {
			font-size: 1.125rem;
			font-weight: bold;
			margin: 0;
		}

		.invoice-container .remittance-subtitle {
			font-size: 0.5rem !important;
			font-weight: 500;
			margin: 0;
		}

		.invoice-container .remittance-grid {
			display: table;
			width: 100%;
			margin-top: 0px;
		}

		.invoice-container .remittance-row {
			display: table-row;
		}

		.invoice-container .remittance-section {
			display: table-cell;
			width: 50%;
			vertical-align: top;
		}

		.invoice-container .right {
			text-align: right;
			justify-self: right;
			justify-content: right;
		}

		.invoice-container .left {
			text-align: left;
			justify-self: left;
			justify-content: left;
		}

		.invoice-container .remittance-section h3 {
			font-size: 12px;
			font-weight: bold;
			margin: 0;
			padding: 0;
		}

		.invoice-container .remittance-section p {
			font-size: 8px;
			margin: 0;
			padding: 0;
		}

		.invoice-container .remittance-contact-section {
			vertical-align: top;
		}

		.invoice-container .remittance-contact-section h3 {
			font-size: 12px;
			font-weight: bold;
			margin: 0;
			padding: 0;
		}

		.invoice-container .remittance-contact-section p {
			font-size: 8px;
			margin: 0;
			padding: 0;
		}

		.invoice-container .remittance-table {
			font-size: 12px;
			width: 100%;
			border-collapse: collapse;
		}

		.invoice-container .remittance-table td {
			padding: 0;
			text-align: left !important;
		}

		.invoice-container .remittance-table td:last-child {
			text-align: right !important;
		}

		.invoice-container .remittance-table .label {
			font-weight: bold;
		}
	</style>
</head>
<body>
	<div class="invoice-container">
		<div class="main-content">
			<div id="document_header">
				<div id="header_left">
					<img src="${data.logo_path}" alt="DBCA Logo" />
				</div>
				<div id="header_right">
					<div class="tax-invoice-title">Tax Invoice</div>
					<p class="invoice-number">#${data.invoice_id}</p>
				</div>
			</div>

			<div class="police-case-info">
				<div class="police-case-left">
					<div><span>Issued:</span> ${data.issue_date}</div>
					<div><span>Due:</span> ${data.due_date}</div>
				</div>
				<div class="police-case-right">
					<div><span>Att:</span> ${data.police_name}, ${data.police_id}</div>
					<div><span>Case:</span> ${data.case_number}</div>
				</div>
			</div>

			<div class="info-section">
				<div class="info-column">
					<h2>From</h2>
					<p class="company-name">${data.dbca_org_data.name}</p>
					<p>${data.dbca_org_data.address}</p>
					<p>${data.dbca_org_data.city}, ${data.dbca_org_data.state} ${
		data.dbca_org_data.zip
	}</p>
					<p>${data.dbca_org_data.tax_id}</p>
				</div>
				<div class="info-column">
					<h2>Billed To</h2>
					<p class="company-name">${data.billed_to.name}</p>
					<p>${data.billed_to.address}</p>
					<p>${data.billed_to.city}, ${data.billed_to.state} ${data.billed_to.zip}</p>
					<p>${data.billed_to.phone}</p>
				</div>
			</div>

			<div class="footer-info">
				<div class="footer-left">
					<span>Approved Botanist</span>
					<span>Enquiries</span>
				</div>
				<div class="footer-right">
					<span>${data.approved_botanist}</span>
					<div class="footer-contacts">
						<span>${data.finance_officer}</span>
						<span>${data.dbca_org_data.phone}</span>
						<span>${data.dbca_org_data.email}</span>
					</div>
				</div>
			</div>

			<div class="table-container">
				<table class="invoice-table">
					<thead>
						<tr>
							<th class="item-col">Item</th>
							<th class="service-col">Service</th>
							<th class="qty-col">Qty</th>
							<th class="rate-col">Rate</th>
							<th class="total-col">Line total</th>
						</tr>
					</thead>
					<tbody>
						${data.services
							.map(
								(service, index) => `
						<tr class="service-row ${
							index === data.services.length - 1
								? "last-service"
								: ""
						}">
							<td class="item-cell">
								<span class="item-number">${index + 1}</span>
							</td>
							<td class="service-cell">
								<div>
									<div class="service-name">${service.name}</div>
									${
										service.description
											? `<div class="service-description">${service.description}</div>`
											: ""
									}
								</div>
							</td>
							<td class="qty-cell">${service.quantity}</td>
							<td class="rate-cell">A$${service.rate.toFixed(2)}</td>
							<td class="total-cell">A$${service.line_total.toFixed(2)}</td>
						</tr>
						`
							)
							.join("")}
						<tr class="table-separator">
							<td colspan="5" style="height: 1px"></td>
						</tr>
					</tbody>
				</table>
				<div class="summary-row">
					<div class="summary-cell" style="flex-shrink: none"></div>
					<div class="summary-cell">
						<div class="summary-label">Subtotal</div>
						<div class="summary-value">A$${data.subtotal.toFixed(2)}</div>
					</div>
					<div class="summary-cell">
						<div class="summary-label">GST (${data.tax_rate_percent}%)</div>
						<div class="summary-value">A$${data.tax.toFixed(2)}</div>
					</div>
					<div class="summary-cell">
						<div class="summary-label">Total Due</div>
						<div class="summary-value">A$${data.total.toFixed(2)}</div>
					</div>
				</div>
			</div>
		</div>

		<div class="remittance-container">
			<div class="dashed-separator">
				<div class="dashed-line"></div>
			</div>

			<div class="remittance-advice">
				<div id="remittance-header">
					<div id="remittance-header-left">
						<img src="${data.logo_square}" alt="DBCA Logo" />
						<div style="text-align: left">
							<h2 class="remittance-title">Remittance Advice</h2>
							<p class="remittance-subtitle">PLEASE DETACH AND RETURN WITH YOUR PAYMENT</p>
							<p class="remittance-subtitle">${data.dbca_org_data.tax_id}</p>
						</div>
					</div>
					<div id="remittance-header-right">
						<div class="remittance-contact-section right">
							<h3>Remittance Advice to be faxed to</h3>
							<p>${data.finance_officer}</p>
							<p>Fax ${data.dbca_org_data.phone}</p>
							<p>Email: ${data.dbca_org_data.email}</p>
						</div>
					</div>
				</div>

				<div class="remittance-grid">
					<div class="remittance-row">
						<div class="remittance-section left">
							<h3>Pay By Cheque</h3>
							<p>Make cheque payable to: ${data.dbca_org_data.name}</p>
							<p>Mail to: ${data.dbca_org_data.name}</p>
							<p>${data.dbca_org_data.address}</p>
							<p>${data.dbca_org_data.city}, ${data.dbca_org_data.state} ${
		data.dbca_org_data.zip
	}</p>
						</div>
						<div class="remittance-section right">
							<h3>Pay By Direct Deposit</h3>
							<p>BSB 066-040</p>
							<p>A/C No 11300006</p>
							<p>Account Name: ${data.dbca_org_data.name}</p>
							<p>Reference: ${data.invoice_id}</p>
						</div>
					</div>
				</div>
			</div>

			<div style="margin-top: 12px">
				<table class="remittance-table">
					<tbody>
						<tr>
							<td>
								<div style="display: flex; flex-direction: column;">
									<span class="label">Customer Number</span>
									<span>${data.police_id}</span>
								</div>
							</td>
							<td>
								<div style="display: flex; flex-direction: column;">
									<span class="label">Invoice Number</span>
									<span>${data.invoice_id}</span>
								</div>
							</td>
							<td>
								<div style="display: flex; flex-direction: column;">
									<span class="label">Invoice Date</span>
									<span>${data.issue_date}</span>
								</div>
							</td>
							<td>
								<div style="display: flex; flex-direction: column;">
									<span class="label">Invoice Total</span>
									<span>A$${data.total.toFixed(2)}</span>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</body>
</html>
	`.trim();
};
