import {
	makeObservable,
	observable,
	action,
	computed,
	runInAction,
} from "mobx";
import { logger } from "@/shared/services/logger.service";
import { storage } from "@/shared/services/storage.service";
import type {
	SubmissionCreateRequest,
	DrugBagContentType,
	BotanicalDetermination,
	UserTiny,
	PoliceOfficerTiny,
	PoliceStationTiny,
	DefendantTiny,
} from "@/shared/types/backend-api.types";
import {
	createSubmissionSchema,
	type CreateSubmissionFormData,
} from "@/features/submissions/schemas/submissionSchemas";
import {
	createDrugBagSchema,
	type CreateDrugBagFormData,
} from "@/features/submissions/schemas/drugBagSchemas";
import { z } from "zod";

// View mode types
export type ViewMode = "data-entry" | "dual-view" | "preview-only";

// Form section types for navigation
export type FormSection = "case-details" | "officers-station" | "drug-bags";

// Drug bag form data interface
export interface DrugBagFormData {
	id?: number; // For existing bags
	content_type: DrugBagContentType;
	seal_tag_numbers: string;
	new_seal_tag_numbers: string;
	property_reference: string;
	gross_weight: string;
	net_weight: string;
	// Assessment data (if applicable)
	determination?: BotanicalDetermination;
	assessment_date?: string;
	botanist_notes?: string;
}

// Complete submission form data interface
export interface SubmissionFormData {
	// Case details
	case_number: string;
	received: string;
	security_movement_envelope: string;
	internal_comments: string;

	// Officer assignments (IDs)
	requesting_officer_id?: number;
	submitting_officer_id?: number;
	station_id?: number;
	approved_botanist_id?: number;
	finance_officer_id?: number;

	// Defendants (array of IDs)
	defendant_ids: number[];

	// Assessment details
	assessment_date: string; // ISO date string (YYYY-MM-DD)

	// Drug bags
	bags: DrugBagFormData[];
}

// Certificate data interface for preview
export interface CertificateData {
	case_number: string;
	received_date: string;
	requesting_officer?: PoliceOfficerTiny;
	submitting_officer?: PoliceOfficerTiny;
	station?: PoliceStationTiny;
	defendants: DefendantTiny[];
	bags: DrugBagFormData[];
	total_bags: number;
	cannabis_present: boolean;
	approved_botanist?: UserTiny;
}

// Validation error interface
export interface ValidationErrors {
	[key: string]: string | string[];
}

export class SubmissionFormStore {
	// Form data state
	formData: SubmissionFormData = {
		case_number: "",
		received: new Date().toISOString().split("T")[0], // Default to today
		security_movement_envelope: "",
		internal_comments: "",
		requesting_officer_id: undefined,
		submitting_officer_id: undefined,
		station_id: undefined,
		approved_botanist_id: undefined,
		finance_officer_id: undefined,
		defendant_ids: [],
		assessment_date: new Date().toISOString().split("T")[0], // Default to today
		bags: [],
	};

	// UI state
	currentView: ViewMode = "data-entry";
	activeSection: FormSection = "case-details";
	isSubmitting: boolean = false;
	isDirty: boolean = false;
	lastSaved: Date | null = null;

	// Validation state
	validationErrors: ValidationErrors = {};
	hasValidationErrors: boolean = false;

	// Auto-save state
	autoSaveEnabled: boolean = true;
	autoSaveInterval: number = 30000; // 30 seconds
	private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
	private storageKey: string = "submission-form-draft";

	// Related entity data (for display purposes)
	selectedOfficers: {
		requesting?: PoliceOfficerTiny;
		submitting?: PoliceOfficerTiny;
	} = {};
	selectedStation?: PoliceStationTiny;
	selectedBotanist?: UserTiny;
	selectedFinanceOfficer?: UserTiny;
	selectedDefendants: DefendantTiny[] = [];

	constructor() {
		makeObservable(this, {
			// Observable state
			formData: observable,
			currentView: observable,
			activeSection: observable,
			isSubmitting: observable,
			isDirty: observable,
			lastSaved: observable,
			validationErrors: observable,
			hasValidationErrors: observable,
			autoSaveEnabled: observable,
			selectedOfficers: observable,
			selectedStation: observable,
			selectedBotanist: observable,
			selectedFinanceOfficer: observable,
			selectedDefendants: observable,

			// Actions
			updateField: action,
			setView: action,
			setActiveSection: action,
			setSubmitting: action,
			addDrugBag: action,
			removeDrugBag: action,
			updateDrugBag: action,
			reorderDrugBags: action,
			setValidationErrors: action,
			clearValidationErrors: action,
			resetForm: action,
			loadDraft: action,
			loadFromSubmission: action,
			setSelectedOfficer: action,
			setSelectedStation: action,
			setSelectedBotanist: action,
			setSelectedFinanceOfficer: action,
			setSelectedDefendants: action,
			markClean: action,
			markDirty: action,

			// Computed values
			isValid: computed,
			totalBags: computed,
			hasAssessments: computed,
			certificateData: computed,
			canSubmit: computed,
			formProgress: computed,
			requiredFieldsCompleted: computed,
			caseDetailsProgress: computed,
			officersProgress: computed,
			drugBagsProgress: computed,
		});

		// Initialize auto-save
		this.setupAutoSave();

		// Load any existing draft
		this.loadDraft();

		logger.info("SubmissionFormStore initialized", {
			autoSaveEnabled: this.autoSaveEnabled,
			currentView: this.currentView,
		});
	}

	// ============================================================================
	// FORM DATA ACTIONS
	// ============================================================================

	updateField = (field: keyof SubmissionFormData, value: any) => {
		runInAction(() => {
			(this.formData as any)[field] = value;

			// Auto-update assessment_date when received date changes (if assessment_date hasn't been manually set)
			if (field === "received" && value) {
				const receivedDate = value.split("T")[0]; // Extract date part (YYYY-MM-DD)
				// Only update if assessment_date is still today's date (hasn't been manually changed)
				const today = new Date().toISOString().split("T")[0];
				if (this.formData.assessment_date === today) {
					this.formData.assessment_date = receivedDate;
				}
			}

			this.markDirty();
		});

		// Clear field-specific validation errors
		this.clearFieldError(field);

		logger.debug("Form field updated", { field, value });
	};

	setSelectedOfficer = (
		type: "requesting" | "submitting",
		officer: PoliceOfficerTiny | null
	) => {
		runInAction(() => {
			if (officer) {
				this.selectedOfficers[type] = officer;
				if (type === "requesting") {
					this.formData.requesting_officer_id = officer.id;
				} else {
					this.formData.submitting_officer_id = officer.id;
				}
			} else {
				delete this.selectedOfficers[type];
				if (type === "requesting") {
					this.formData.requesting_officer_id = undefined;
				} else {
					this.formData.submitting_officer_id = undefined;
				}
			}
			this.markDirty();
		});

		logger.debug("Selected officer updated", {
			type,
			officer: officer?.full_name,
		});
	};

	setSelectedStation = (station: PoliceStationTiny | null) => {
		runInAction(() => {
			this.selectedStation = station || undefined;
			this.formData.station_id = station?.id;
			this.markDirty();
		});

		logger.debug("Selected station updated", { station: station?.name });
	};

	setSelectedBotanist = (botanist: UserTiny | null) => {
		runInAction(() => {
			this.selectedBotanist = botanist || undefined;
			this.formData.approved_botanist_id = botanist?.id;
			this.markDirty();
		});

		logger.debug("Selected botanist updated", {
			botanist: botanist?.full_name,
		});
	};

	setSelectedFinanceOfficer = (financeOfficer: UserTiny | null) => {
		runInAction(() => {
			this.selectedFinanceOfficer = financeOfficer || undefined;
			this.formData.finance_officer_id = financeOfficer?.id;
			this.markDirty();
		});

		logger.debug("Selected finance officer updated", {
			financeOfficer: financeOfficer?.full_name,
		});
	};

	setSelectedDefendants = (defendants: DefendantTiny[]) => {
		runInAction(() => {
			this.selectedDefendants = defendants;
			this.formData.defendant_ids = defendants.map((d) => d.id);
			this.markDirty();
		});

		logger.debug("Selected defendants updated", {
			count: defendants.length,
		});
	};

	// ============================================================================
	// DRUG BAG MANAGEMENT
	// ============================================================================

	addDrugBag = () => {
		const newBag: DrugBagFormData = {
			content_type: "unknown",
			seal_tag_numbers: "",
			new_seal_tag_numbers: "",
			property_reference: "",
			gross_weight: "",
			net_weight: "",
		};

		runInAction(() => {
			this.formData.bags.push(newBag);
			this.markDirty();
		});

		logger.debug("Drug bag added", {
			totalBags: this.formData.bags.length,
		});
	};

	removeDrugBag = (index: number) => {
		if (index >= 0 && index < this.formData.bags.length) {
			runInAction(() => {
				this.formData.bags.splice(index, 1);
				this.markDirty();
			});

			logger.debug("Drug bag removed", {
				index,
				remainingBags: this.formData.bags.length,
			});
		}
	};

	updateDrugBag = (index: number, data: Partial<DrugBagFormData>) => {
		if (index >= 0 && index < this.formData.bags.length) {
			runInAction(() => {
				this.formData.bags[index] = {
					...this.formData.bags[index],
					...data,
				};
				this.markDirty();
			});

			logger.debug("Drug bag updated", {
				index,
				updatedFields: Object.keys(data),
			});
		}
	};

	reorderDrugBags = (fromIndex: number, toIndex: number) => {
		if (
			fromIndex >= 0 &&
			fromIndex < this.formData.bags.length &&
			toIndex >= 0 &&
			toIndex < this.formData.bags.length &&
			fromIndex !== toIndex
		) {
			runInAction(() => {
				const [movedBag] = this.formData.bags.splice(fromIndex, 1);
				this.formData.bags.splice(toIndex, 0, movedBag);
				this.markDirty();
			});

			logger.debug("Drug bags reordered", { fromIndex, toIndex });
		}
	};

	// ============================================================================
	// VIEW AND NAVIGATION MANAGEMENT
	// ============================================================================

	setView = (view: ViewMode) => {
		runInAction(() => {
			this.currentView = view;
		});

		logger.debug("View mode changed", { view });
	};

	setActiveSection = (section: FormSection) => {
		runInAction(() => {
			this.activeSection = section;
		});

		logger.debug("Active section changed", { section });
	};

	// ============================================================================
	// VALIDATION MANAGEMENT
	// ============================================================================

	validateForm = (): boolean => {
		try {
			// Validate main form data
			const mainFormData: CreateSubmissionFormData = {
				case_number: this.formData.case_number,
				received: this.formData.received,
				security_movement_envelope:
					this.formData.security_movement_envelope,
				requesting_officer: this.formData.requesting_officer_id || null,
				submitting_officer: this.formData.submitting_officer_id || null,
				defendants: this.formData.defendant_ids,
			};

			createSubmissionSchema.parse(mainFormData);

			// Validate drug bags
			const bagErrors: ValidationErrors = {};
			this.formData.bags.forEach((bag, index) => {
				try {
					const bagData: CreateDrugBagFormData = {
						submission: 1, // Placeholder - will be set on submission
						content_type: bag.content_type,
						seal_tag_numbers: bag.seal_tag_numbers,
						new_seal_tag_numbers: bag.new_seal_tag_numbers || null,
						property_reference: bag.property_reference || null,
						gross_weight: bag.gross_weight || null,
						net_weight: bag.net_weight || null,
					};

					createDrugBagSchema.parse(bagData);
				} catch (error) {
					if (error instanceof z.ZodError) {
						error.issues.forEach((err) => {
							bagErrors[`bags.${index}.${err.path.join(".")}`] =
								err.message;
						});
					}
				}
			});

			// Set validation errors
			this.setValidationErrors(bagErrors);

			const isValid = Object.keys(bagErrors).length === 0;
			logger.debug("Form validation completed", {
				isValid,
				errorCount: Object.keys(bagErrors).length,
			});

			return isValid;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors: ValidationErrors = {};
				error.issues.forEach((err) => {
					errors[err.path.join(".")] = err.message;
				});
				this.setValidationErrors(errors);
				return false;
			}

			logger.error("Form validation error", { error });
			return false;
		}
	};

	setValidationErrors = (errors: ValidationErrors) => {
		runInAction(() => {
			this.validationErrors = errors;
			this.hasValidationErrors = Object.keys(errors).length > 0;
		});
	};

	clearValidationErrors = () => {
		runInAction(() => {
			this.validationErrors = {};
			this.hasValidationErrors = false;
		});
	};

	clearFieldError = (field: string) => {
		if (this.validationErrors[field]) {
			runInAction(() => {
				delete this.validationErrors[field];
				this.hasValidationErrors =
					Object.keys(this.validationErrors).length > 0;
			});
		}
	};

	// ============================================================================
	// SUBMISSION STATE MANAGEMENT
	// ============================================================================

	setSubmitting = (submitting: boolean) => {
		runInAction(() => {
			this.isSubmitting = submitting;
		});
	};

	markDirty = () => {
		runInAction(() => {
			this.isDirty = true;
		});

		// Trigger auto-save if enabled
		if (this.autoSaveEnabled) {
			this.scheduleAutoSave();
		}
	};

	markClean = () => {
		runInAction(() => {
			this.isDirty = false;
			this.lastSaved = new Date();
		});
	};

	// ============================================================================
	// AUTO-SAVE FUNCTIONALITY
	// ============================================================================

	setupAutoSave = () => {
		if (this.autoSaveEnabled) {
			logger.debug("Auto-save enabled", {
				interval: this.autoSaveInterval,
			});
		}
	};

	scheduleAutoSave = () => {
		if (!this.autoSaveEnabled) return;

		// Clear existing timer
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
		}

		// Schedule new auto-save
		this.autoSaveTimer = setTimeout(() => {
			this.saveDraft();
		}, this.autoSaveInterval);
	};

	saveDraft = () => {
		try {
			const draftData = {
				formData: this.formData,
				selectedOfficers: this.selectedOfficers,
				selectedStation: this.selectedStation,
				selectedBotanist: this.selectedBotanist,
				selectedFinanceOfficer: this.selectedFinanceOfficer,
				selectedDefendants: this.selectedDefendants,
				currentView: this.currentView,
				activeSection: this.activeSection,
				timestamp: new Date().toISOString(),
			};

			storage.setItem(this.storageKey, draftData);
			this.markClean();

			logger.debug("Draft saved", {
				timestamp: draftData.timestamp,
				bagsCount: this.formData.bags.length,
			});
		} catch (error) {
			logger.error("Failed to save draft", { error });
		}
	};

	loadDraft = () => {
		try {
			const draftData = storage.getItem(this.storageKey) as any;
			if (draftData && typeof draftData === "object") {
				runInAction(() => {
					this.formData = { ...this.formData, ...draftData.formData };
					this.selectedOfficers = draftData.selectedOfficers || {};
					this.selectedStation = draftData.selectedStation;
					this.selectedBotanist = draftData.selectedBotanist;
					this.selectedFinanceOfficer =
						draftData.selectedFinanceOfficer;
					this.selectedDefendants =
						draftData.selectedDefendants || [];
					this.currentView = draftData.currentView || "data-entry";
					this.activeSection =
						draftData.activeSection || "case-details";
					this.isDirty = false;
				});

				logger.info("Draft loaded", {
					timestamp: draftData.timestamp,
					bagsCount: this.formData.bags.length,
				});
			}
		} catch (error) {
			logger.error("Failed to load draft", { error });
		}
	};

	loadFromSubmission = (submission: any) => {
		try {
			runInAction(() => {
				// Load basic form data
				this.formData.case_number = submission.case_number || "";
				this.formData.received = submission.received || "";
				this.formData.security_movement_envelope =
					submission.security_movement_envelope || "";
				this.formData.internal_comments =
					submission.internal_comments || "";

				// Load officer IDs
				this.formData.requesting_officer_id =
					submission.requesting_officer || undefined;
				this.formData.submitting_officer_id =
					submission.submitting_officer || undefined;
				this.formData.station_id = submission.station || undefined;
				this.formData.approved_botanist_id =
					submission.approved_botanist || undefined;
				this.formData.finance_officer_id =
					submission.finance_officer || undefined;

				// Load defendant IDs
				this.formData.defendant_ids = submission.defendants || [];

				// Load assessment date
				this.formData.assessment_date =
					submission.assessment_date ||
					new Date().toISOString().split("T")[0];

				// Load drug bags
				this.formData.bags =
					submission.bags?.map((bag: any) => ({
						id: bag.id,
						content_type: bag.content_type || "unknown",
						seal_tag_numbers: bag.seal_tag_numbers || "",
						new_seal_tag_numbers: bag.new_seal_tag_numbers || "",
						property_reference: bag.property_reference || "",
						gross_weight: bag.gross_weight || "",
						net_weight: bag.net_weight || "",
						determination:
							bag.assessment?.determination || "pending",
						assessment_date: bag.assessment?.assessment_date || "",
						botanist_notes: bag.assessment?.botanist_notes || "",
					})) || [];

				// Load selected entities for display
				if (submission.requesting_officer_details) {
					this.selectedOfficers.requesting =
						submission.requesting_officer_details;
				}
				if (submission.submitting_officer_details) {
					this.selectedOfficers.submitting =
						submission.submitting_officer_details;
				}
				if (submission.station_details) {
					this.selectedStation = submission.station_details;
				}
				if (submission.approved_botanist_details) {
					this.selectedBotanist =
						submission.approved_botanist_details;
				}
				if (submission.finance_officer_details) {
					this.selectedFinanceOfficer =
						submission.finance_officer_details;
				}
				if (submission.defendants_details) {
					this.selectedDefendants = submission.defendants_details;
				}

				this.isDirty = false;
			});

			logger.info("Submission loaded into form", {
				submissionId: submission.id,
				caseNumber: submission.case_number,
				bagsCount: this.formData.bags.length,
			});
		} catch (error) {
			logger.error("Failed to load submission into form", { error });
		}
	};

	clearDraft = () => {
		try {
			storage.removeItem(this.storageKey);
			logger.debug("Draft cleared");
		} catch (error) {
			logger.error("Failed to clear draft", { error });
		}
	};

	// ============================================================================
	// FORM RESET AND CLEANUP
	// ============================================================================

	resetForm = () => {
		runInAction(() => {
			this.formData = {
				case_number: "",
				received: new Date().toISOString().split("T")[0], // Reset to today
				security_movement_envelope: "",
				internal_comments: "",
				requesting_officer_id: undefined,
				submitting_officer_id: undefined,
				station_id: undefined,
				approved_botanist_id: undefined,
				finance_officer_id: undefined,
				defendant_ids: [],
				assessment_date: new Date().toISOString().split("T")[0], // Reset to today
				bags: [],
			};

			this.selectedOfficers = {};
			this.selectedStation = undefined;
			this.selectedBotanist = undefined;
			this.selectedFinanceOfficer = undefined;
			this.selectedDefendants = [];

			this.currentView = "data-entry";
			this.activeSection = "case-details";
			this.isSubmitting = false;
			this.isDirty = false;
			this.lastSaved = null;

			this.clearValidationErrors();
		});

		// Clear auto-save timer
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}

		// Clear draft
		this.clearDraft();

		logger.info("Form reset completed");
	};

	// ============================================================================
	// COMPUTED VALUES
	// ============================================================================

	get isValid(): boolean {
		return !this.hasValidationErrors && this.validateForm();
	}

	get totalBags(): number {
		return this.formData.bags.length;
	}

	get hasAssessments(): boolean {
		return this.formData.bags.some(
			(bag) => bag.determination && bag.determination !== "pending"
		);
	}

	get canSubmit(): boolean {
		return (
			this.isValid &&
			!this.isSubmitting &&
			this.formData.case_number.trim() !== "" &&
			this.formData.received.trim() !== "" &&
			this.formData.security_movement_envelope.trim() !== ""
		);
	}

	get formProgress(): number {
		const requiredFields = [
			this.formData.case_number,
			this.formData.received,
			this.formData.security_movement_envelope,
		];

		const completedFields = requiredFields.filter(
			(field) => field && field.toString().trim() !== ""
		).length;

		const optionalCompletedFields = [
			this.formData.requesting_officer_id,
			this.formData.submitting_officer_id,
			this.formData.defendant_ids.length > 0,
			this.formData.bags.length > 0,
		].filter(Boolean).length;

		const totalPossibleFields = requiredFields.length + 4; // 4 optional sections
		const totalCompletedFields = completedFields + optionalCompletedFields;

		return Math.round((totalCompletedFields / totalPossibleFields) * 100);
	}

	// Per-tab progress calculations
	get caseDetailsProgress(): number {
		const requiredFields = [
			this.formData.case_number, // Police Reference No.
			this.formData.received, // Received Date
			this.formData.security_movement_envelope, // Security Movement Envelope Number
		];

		const completedFields = requiredFields.filter(
			(field) => field && field.toString().trim() !== ""
		).length;

		return Math.round((completedFields / requiredFields.length) * 100);
	}

	get officersProgress(): number {
		const requiredFields = [
			this.formData.submitting_officer_id, // Submitting Officer
			this.formData.station_id, // Police Station
			this.formData.approved_botanist_id, // Approved Botanist
			this.formData.finance_officer_id, // Finance Officer
		];

		const completedFields = requiredFields.filter(
			(field) => field !== undefined && field !== null
		).length;

		return Math.round((completedFields / requiredFields.length) * 100);
	}

	get drugBagsProgress(): number {
		// Required fields for Assessment tab
		const requiredFields = [
			this.formData.assessment_date &&
				this.formData.assessment_date.trim() !== "", // Assessment Date
			this.formData.bags.length > 0, // At least one bag
		];

		// Check if Additional Notes (Section C) is filled
		const hasAdditionalNotes = this.formData.bags.some(
			(bag) => bag.botanist_notes && bag.botanist_notes.trim() !== ""
		);

		// For each bag, check required fields
		let totalRequiredFields = requiredFields.length; // Start with assessment date + at least one bag
		let completedRequiredFields = requiredFields.filter(Boolean).length;

		this.formData.bags.forEach((bag) => {
			// Required fields per bag: Content Type, Original Seal Tag Numbers, New Seal Tag Numbers, Determination
			const bagRequiredFields = [
				bag.content_type && bag.content_type !== "unknown",
				bag.seal_tag_numbers && bag.seal_tag_numbers.trim() !== "",
				bag.new_seal_tag_numbers &&
					bag.new_seal_tag_numbers.trim() !== "",
				bag.determination && bag.determination !== "pending",
			];

			totalRequiredFields += bagRequiredFields.length;
			completedRequiredFields += bagRequiredFields.filter(Boolean).length;
		});

		// Add Additional Notes as a required field
		totalRequiredFields += 1;
		if (hasAdditionalNotes) {
			completedRequiredFields += 1;
		}

		return Math.round(
			(completedRequiredFields / totalRequiredFields) * 100
		);
	}

	get requiredFieldsCompleted(): boolean {
		return (
			this.formData.case_number.trim() !== "" &&
			this.formData.received.trim() !== "" &&
			this.formData.security_movement_envelope.trim() !== ""
		);
	}

	get certificateData(): CertificateData {
		return {
			case_number: this.formData.case_number,
			received_date: this.formData.received,
			requesting_officer: this.selectedOfficers.requesting,
			submitting_officer: this.selectedOfficers.submitting,
			station: this.selectedStation,
			defendants: this.selectedDefendants,
			bags: this.formData.bags,
			total_bags: this.totalBags,
			cannabis_present: this.formData.bags.some(
				(bag) =>
					bag.determination === "cannabis_sativa" ||
					bag.determination === "cannabis_indica" ||
					bag.determination === "cannabis_hybrid"
			),
			approved_botanist: this.selectedBotanist,
		};
	}

	// ============================================================================
	// API PREPARATION METHODS
	// ============================================================================

	getSubmissionCreateRequest = (
		isDraft: boolean = false
	): SubmissionCreateRequest => {
		return {
			case_number: this.formData.case_number,
			received: this.formData.received,
			security_movement_envelope:
				this.formData.security_movement_envelope,
			requesting_officer: this.formData.requesting_officer_id || null,
			submitting_officer: this.formData.submitting_officer_id || null,
			defendants: this.formData.defendant_ids,
			is_draft: isDraft,
		};
	};

	// Auto-populate Additional Notes (Section C) based on bag count and envelope number
	getAutoPopulatedAdditionalNotes = (): string => {
		const bagCount = this.formData.bags.length;
		const envelopeNumber = this.formData.security_movement_envelope;

		if (!envelopeNumber || bagCount === 0) {
			return "";
		}

		const bagText = bagCount === 1 ? "the bag" : "each bag";
		return `Subsamples from ${bagText} removed to Security Movement Envelope ${envelopeNumber}`;
	};

	// ============================================================================
	// CLEANUP
	// ============================================================================

	dispose = () => {
		// Clear auto-save timer
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}

		logger.info("SubmissionFormStore disposed");
	};
}
