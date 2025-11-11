import {
	makeObservable,
	observable,
	action,
	computed,
	runInAction,
} from "mobx";
import { logger } from "@/shared/services/logger.service";
import type { CertificateData } from "./submissionForm.store";

// Certificate preview state interface
export interface CertificatePreviewState {
	isGenerating: boolean;
	lastGenerated: Date | null;
	error: string | null;
	previewData: CertificateData | null;
}

// Certificate template types
export type CertificateTemplate = "standard" | "detailed" | "summary";

// Certificate format options
export interface CertificateFormatOptions {
	template: CertificateTemplate;
	includePhotos: boolean;
	includeAssessmentNotes: boolean;
	includeChainOfCustody: boolean;
	watermark: boolean;
}

export class CertificatePreviewStore {
	// Preview state
	state: CertificatePreviewState = {
		isGenerating: false,
		lastGenerated: null,
		error: null,
		previewData: null,
	};

	// Format options
	formatOptions: CertificateFormatOptions = {
		template: "standard",
		includePhotos: false,
		includeAssessmentNotes: true,
		includeChainOfCustody: true,
		watermark: true,
	};

	// Preview settings
	autoRefresh: boolean = true;
	refreshDelay: number = 500; // 500ms delay for debouncing
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		makeObservable(this, {
			// Observable state
			state: observable,
			formatOptions: observable,
			autoRefresh: observable,

			// Actions
			setPreviewData: action,
			setGenerating: action,
			setError: action,
			clearError: action,
			updateFormatOptions: action,
			setAutoRefresh: action,
			reset: action,

			// Computed values
			isReady: computed,
			hasData: computed,
			canGenerate: computed,
			previewSummary: computed,
		});

		logger.info("CertificatePreviewStore initialized", {
			autoRefresh: this.autoRefresh,
			template: this.formatOptions.template,
		});
	}

	// ============================================================================
	// PREVIEW DATA MANAGEMENT
	// ============================================================================

	setPreviewData = (data: CertificateData | null) => {
		runInAction(() => {
			this.state.previewData = data;
			this.state.lastGenerated = data ? new Date() : null;
			this.state.error = null;
		});

		if (data) {
			logger.debug("Certificate preview data updated", {
				caseNumber: data.case_number,
				bagsCount: data.total_bags,
				cannabisPresent: data.cannabis_present,
			});
		}
	};

	updatePreviewData = (data: CertificateData) => {
		if (!this.autoRefresh) {
			return;
		}

		// Clear existing timer
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}

		// Debounce the update
		this.refreshTimer = setTimeout(() => {
			this.setPreviewData(data);
		}, this.refreshDelay);
	};

	// ============================================================================
	// GENERATION STATE MANAGEMENT
	// ============================================================================

	setGenerating = (generating: boolean) => {
		runInAction(() => {
			this.state.isGenerating = generating;
			if (generating) {
				this.state.error = null;
			}
		});

		logger.debug("Certificate generation state changed", { generating });
	};

	setError = (error: string | null) => {
		runInAction(() => {
			this.state.error = error;
			this.state.isGenerating = false;
		});

		if (error) {
			logger.error("Certificate preview error", { error });
		}
	};

	clearError = () => {
		runInAction(() => {
			this.state.error = null;
		});
	};

	// ============================================================================
	// FORMAT OPTIONS MANAGEMENT
	// ============================================================================

	updateFormatOptions = (options: Partial<CertificateFormatOptions>) => {
		runInAction(() => {
			this.formatOptions = { ...this.formatOptions, ...options };
		});

		// Trigger preview refresh if auto-refresh is enabled
		if (this.autoRefresh && this.state.previewData) {
			this.updatePreviewData(this.state.previewData);
		}

		logger.debug("Certificate format options updated", {
			updatedOptions: options,
			currentOptions: this.formatOptions,
		});
	};

	setTemplate = (template: CertificateTemplate) => {
		this.updateFormatOptions({ template });
	};

	toggleOption = (
		option: keyof Omit<CertificateFormatOptions, "template">
	) => {
		const currentValue = this.formatOptions[option];
		this.updateFormatOptions({ [option]: !currentValue });
	};

	// ============================================================================
	// AUTO-REFRESH MANAGEMENT
	// ============================================================================

	setAutoRefresh = (enabled: boolean) => {
		runInAction(() => {
			this.autoRefresh = enabled;
		});

		// Clear timer if disabling auto-refresh
		if (!enabled && this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		logger.debug("Auto-refresh setting changed", { enabled });
	};

	// ============================================================================
	// PREVIEW GENERATION METHODS
	// ============================================================================

	generatePreview = async (data: CertificateData): Promise<void> => {
		this.setGenerating(true);

		try {
			// Simulate preview generation (replace with actual implementation)
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Validate data before generating preview
			if (!this.validatePreviewData(data)) {
				throw new Error("Invalid certificate data provided");
			}

			this.setPreviewData(data);

			logger.info("Certificate preview generated successfully", {
				caseNumber: data.case_number,
				template: this.formatOptions.template,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to generate preview";
			this.setError(errorMessage);

			logger.error("Certificate preview generation failed", {
				error: errorMessage,
				caseNumber: data.case_number,
			});
		} finally {
			this.setGenerating(false);
		}
	};

	refreshPreview = async (): Promise<void> => {
		if (!this.state.previewData) {
			logger.warn("Cannot refresh preview: no preview data available");
			return;
		}

		await this.generatePreview(this.state.previewData);
	};

	// ============================================================================
	// VALIDATION METHODS
	// ============================================================================

	validatePreviewData = (data: CertificateData): boolean => {
		// Check required fields
		if (!data.case_number || !data.received_date) {
			return false;
		}

		// Validate date format
		if (isNaN(Date.parse(data.received_date))) {
			return false;
		}

		// Check if we have at least some meaningful data
		const hasOfficerData = !!(
			data.requesting_officer || data.submitting_officer
		);
		const hasDefendantData = data.defendants && data.defendants.length > 0;
		const hasBagData = data.bags && data.bags.length > 0;

		return hasOfficerData || hasDefendantData || hasBagData;
	};

	// ============================================================================
	// EXPORT METHODS
	// ============================================================================

	getPreviewHTML = (): string => {
		if (!this.state.previewData) {
			return "<p>No preview data available</p>";
		}

		// Generate HTML based on template and options
		return this.generatePreviewHTML(this.state.previewData);
	};

	private generatePreviewHTML = (data: CertificateData): string => {
		const { template } = this.formatOptions;

		// Basic HTML structure (replace with actual template rendering)
		const html = `
			<div class="certificate-preview ${template}">
				<header class="certificate-header">
					<h1>Cannabis Botanical Identification Certificate</h1>
					<div class="case-info">
						<p><strong>Case Number:</strong> ${data.case_number}</p>
						<p><strong>Received:</strong> ${new Date(
							data.received_date
						).toLocaleDateString()}</p>
					</div>
				</header>

				<section class="officer-info">
					${
						data.requesting_officer
							? `
						<p><strong>Requesting Officer:</strong> ${data.requesting_officer.full_name}</p>
					`
							: ""
					}
					${
						data.submitting_officer
							? `
						<p><strong>Submitting Officer:</strong> ${data.submitting_officer.full_name}</p>
					`
							: ""
					}
					${
						data.station
							? `
						<p><strong>Station:</strong> ${data.station.name}</p>
					`
							: ""
					}
				</section>

				<section class="defendants-info">
					<h3>Defendants</h3>
					${
						data.defendants.length > 0
							? `
						<ul>
							${data.defendants
								.map(
									(defendant) => `
								<li>${defendant.full_name}</li>
							`
								)
								.join("")}
						</ul>
					`
							: "<p>No defendants specified</p>"
					}
				</section>

				<section class="bags-info">
					<h3>Evidence Bags (${data.total_bags})</h3>
					${
						data.bags.length > 0
							? `
						<table>
							<thead>
								<tr>
									<th>Content Type</th>
									<th>Tag Numbers</th>
									<th>Weight</th>
									<th>Assessment</th>
								</tr>
							</thead>
							<tbody>
								${data.bags
									.map(
										(bag) => `
									<tr>
										<td>${bag.content_type}</td>
										<td>${bag.seal_tag_numbers}</td>
										<td>${bag.gross_weight || "N/A"}</td>
										<td>${bag.determination || "Pending"}</td>
									</tr>
								`
									)
									.join("")}
							</tbody>
						</table>
					`
							: "<p>No evidence bags</p>"
					}
				</section>

				${
					data.cannabis_present
						? `
					<section class="cannabis-determination">
						<h3>Cannabis Determination</h3>
						<p class="cannabis-positive">Cannabis material detected in this submission.</p>
					</section>
				`
						: ""
				}

				${
					data.approved_botanist
						? `
					<footer class="botanist-signature">
						<p><strong>Approved by:</strong> ${data.approved_botanist.full_name}</p>
						<p><strong>Role:</strong> ${data.approved_botanist.role_display}</p>
					</footer>
				`
						: ""
				}

				${
					this.formatOptions.watermark
						? `
					<div class="watermark">PREVIEW</div>
				`
						: ""
				}
			</div>
		`;

		return html;
	};

	// ============================================================================
	// RESET AND CLEANUP
	// ============================================================================

	reset = () => {
		// Clear refresh timer
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		runInAction(() => {
			this.state = {
				isGenerating: false,
				lastGenerated: null,
				error: null,
				previewData: null,
			};

			this.formatOptions = {
				template: "standard",
				includePhotos: false,
				includeAssessmentNotes: true,
				includeChainOfCustody: true,
				watermark: true,
			};

			this.autoRefresh = true;
		});

		logger.info("Certificate preview store reset");
	};

	// ============================================================================
	// COMPUTED VALUES
	// ============================================================================

	get isReady(): boolean {
		return !this.state.isGenerating && !this.state.error;
	}

	get hasData(): boolean {
		return this.state.previewData !== null;
	}

	get canGenerate(): boolean {
		return this.isReady && this.state.previewData !== null;
	}

	get previewSummary(): string {
		if (!this.state.previewData) {
			return "No preview available";
		}

		const data = this.state.previewData;
		const parts = [`Case: ${data.case_number}`, `Bags: ${data.total_bags}`];

		if (data.cannabis_present) {
			parts.push("Cannabis: Yes");
		}

		if (data.defendants.length > 0) {
			parts.push(`Defendants: ${data.defendants.length}`);
		}

		return parts.join(" | ");
	}

	// ============================================================================
	// CLEANUP
	// ============================================================================

	dispose = () => {
		// Clear refresh timer
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}

		logger.info("CertificatePreviewStore disposed");
	};
}
