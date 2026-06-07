import { observer } from "mobx-react-lite";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
	Sparkles,
	X,
	Save,
	Check,
	ArrowLeft,
	ArrowRight,
	Eye,
	PenLine,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { CaseStoresProvider } from "@/features/cases/components/providers/CaseStoresProvider";
import { useCaseFormStore } from "@/features/cases/hooks/useCaseFormStore";
import { useCases } from "@/features/cases/hooks/useCases";
import { CaseDetailsSection } from "@/features/cases/components/forms/sections/CaseDetailsSection";
import { DefendantsSection } from "@/features/cases/components/forms/sections/DefendantsSection";
import { OfficersStationSection } from "@/features/cases/components/forms/sections/OfficersStationSection";
import { DrugBagsSection } from "@/features/cases/components/forms/sections/DrugBagsSection";
import { Head } from "@/shared/components/layout/Head";
import { SectionCard } from "@/features/cases/components/forms/wizard/SectionCard";
import { WizardStepper } from "@/features/cases/components/forms/wizard/WizardStepper";
import type { StepState } from "@/features/cases/components/forms/wizard/WizardStepper";
import { WizardPreviewPanel } from "@/features/cases/components/forms/wizard/WizardPreviewPanel";
import { WizardLayout } from "@/features/cases/components/forms/wizard/WizardLayout";
import type { FormSection } from "@/features/cases/stores/caseForm.store";

const SECTION_TO_STEP: Record<FormSection, number> = {
	"case-details": 0,
	"officers-station": 1,
	"drug-bags": 2,
};

const STEP_TO_SECTION: FormSection[] = [
	"case-details",
	"officers-station",
	"drug-bags",
];

const CreateCaseContent = observer(() => {
	const navigate = useNavigate();
	const formStore = useCaseFormStore();
	const { createCase } = useCases();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [direction, setDirection] = useState(1);

	useEffect(() => {
		formStore.resetForm();
		// Load draft from server/localStorage on mount
		void formStore.loadDraft();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Derive current step from the store's activeSection
	const currentStep = SECTION_TO_STEP[formStore.activeSection] ?? 0;

	// Derive completed steps from progress computeds
	const completedSteps = useMemo(() => {
		const completed = new Set<number>();
		if (formStore.caseDetailsProgress === 100) completed.add(0);
		if (formStore.officersProgress === 100) completed.add(1);
		if (formStore.drugBagsProgress === 100) completed.add(2);
		return completed;
	}, [
		formStore.caseDetailsProgress,
		formStore.officersProgress,
		formStore.drugBagsProgress,
	]);

	// Derive validation state from the form store
	const validation = useMemo<Record<number, { isValid: boolean }>>(() => {
		return {
			0: {
				isValid:
					formStore.caseDetailsProgress > 0 || !formStore.hasValidationErrors,
			},
			1: {
				isValid:
					formStore.officersProgress > 0 || !formStore.hasValidationErrors,
			},
			2: {
				isValid:
					formStore.drugBagsProgress > 0 || !formStore.hasValidationErrors,
			},
		};
	}, [
		formStore.caseDetailsProgress,
		formStore.officersProgress,
		formStore.drugBagsProgress,
		formStore.hasValidationErrors,
	]);

	// Derive step states for the WizardStepper
	const stepStates = useMemo<StepState[]>(() => {
		return [0, 1, 2].map((index): StepState => {
			if (index === currentStep) return "active";
			if (
				completedSteps.has(index) &&
				validation[index] &&
				!validation[index].isValid
			) {
				return "invalid";
			}
			if (completedSteps.has(index)) return "completed";
			return "future";
		});
	}, [currentStep, completedSteps, validation]);

	const handleCancel = () => {
		navigate("/cases");
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const submissionData = formStore.getCaseCreateRequest();
			await new Promise<void>((resolve, reject) => {
				createCase(submissionData, {
					onSuccess: () => {
						void formStore.clearDraft();
						formStore.resetForm();
						resolve();
						handleCancel();
					},
					onError: (error) => {
						reject(error);
					},
				});
			});
		} catch (error) {
			console.error("Create case error:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveDraft = async () => {
		setIsSavingDraft(true);
		try {
			await formStore.saveDraft();
			handleCancel();
		} catch (error) {
			console.error("Save draft error:", error);
		} finally {
			setIsSavingDraft(false);
		}
	};

	const goToStep = (newStep: number) => {
		setDirection(newStep > currentStep ? 1 : -1);
		formStore.setActiveSection(STEP_TO_SECTION[newStep]);
	};

	const allTabsComplete =
		formStore.caseDetailsProgress === 100 &&
		formStore.officersProgress === 100 &&
		formStore.drugBagsProgress === 100;

	// Form panel content (stepper + sections)
	const formPanel = (
		<div>
			{/* Breadcrumb */}
			<motion.div
				initial={{ opacity: 0, y: -4 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex items-center gap-2 text-[13px] text-muted-foreground mb-4"
			>
				<Link
					to="/cases"
					className="hover:text-foreground transition-colors cursor-pointer"
				>
					Cases
				</Link>
				<span>/</span>
				<span className="text-foreground">New Case</span>
			</motion.div>

			{/* Hero header */}
			<div className="relative mb-8 rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/30 dark:via-background dark:to-teal-950/30 p-6">
				<div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-400/30 blur-3xl" />
				<div className="absolute -left-10 -bottom-20 w-48 h-48 rounded-full bg-gradient-to-br from-lime-400/20 to-emerald-400/20 blur-3xl" />
				<div className="flex items-start justify-between gap-4 relative">
					<div>
						<div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 px-2 py-1 rounded-full mb-3">
							<Sparkles className="w-3 h-3" />
							New Case
						</div>
						<h1 className="tracking-tight">Create case</h1>
						<p className="text-muted-foreground text-[14px] mt-1 max-w-xl">
							Document the chain of custody and botanical findings for this
							caseObj. All sections must be completed before finalising.
						</p>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCancel}
							disabled={isSubmitting || isSavingDraft}
							className="cursor-pointer"
						>
							<X className="w-4 h-4 mr-1.5" />
							Cancel
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleSaveDraft}
							disabled={isSavingDraft || isSubmitting}
							className="cursor-pointer"
						>
							<Save className="w-4 h-4 mr-1.5" />
							{isSavingDraft ? "Saving..." : "Save Draft"}
						</Button>
						<Button
							size="sm"
							disabled={!allTabsComplete || isSubmitting || isSavingDraft}
							className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
							onClick={handleSubmit}
						>
							<Sparkles className="w-4 h-4 mr-1.5" />
							{isSubmitting ? "Creating..." : "Finalise"}
						</Button>
					</div>
				</div>
			</div>

			{/* Wizard Stepper */}
			<div className="mb-10">
				<WizardStepper
					currentStep={currentStep}
					stepStates={stepStates}
					onStepClick={goToStep}
				/>
			</div>

			{/* Preview toggle button (visible only on <1920px) */}
			<div className="min-[1920px]:hidden flex justify-end mb-4">
				<Button
					variant="outline"
					size="sm"
					onClick={() => setShowPreview((prev) => !prev)}
					className="cursor-pointer"
				>
					{showPreview ? (
						<>
							<PenLine className="w-4 h-4 mr-1.5" />
							Back to Form
						</>
					) : (
						<>
							<Eye className="w-4 h-4 mr-1.5" />
							Preview
						</>
					)}
				</Button>
			</div>

			{/* Step content with slide transitions */}
			<AnimatePresence mode="wait" custom={direction}>
				<motion.div
					key={currentStep}
					custom={direction}
					initial={{ opacity: 0, x: direction * 40 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: direction * -40 }}
					transition={{ duration: 0.25 }}
				>
					{currentStep === 0 && (
						<SectionCard
							title="Case Details"
							isComplete={formStore.caseDetailsProgress === 100}
						>
							<div className="space-y-6">
								<CaseDetailsSection />
								<DefendantsSection />
							</div>
						</SectionCard>
					)}
					{currentStep === 1 && (
						<SectionCard
							title="Officers & Station"
							isComplete={formStore.officersProgress === 100}
						>
							<OfficersStationSection />
						</SectionCard>
					)}
					{currentStep === 2 && (
						<SectionCard
							title="Assessment"
							isComplete={formStore.drugBagsProgress === 100}
						>
							<DrugBagsSection />
						</SectionCard>
					)}
				</motion.div>
			</AnimatePresence>

			{/* Step navigation footer */}
			<div className="flex items-center justify-between mt-8">
				<Button
					variant="ghost"
					disabled={currentStep === 0}
					onClick={() => goToStep(currentStep - 1)}
					className="cursor-pointer"
				>
					<ArrowLeft className="w-4 h-4 mr-1.5" />
					Back
				</Button>
				<div className="text-[12px] text-muted-foreground">
					Step {currentStep + 1} of {STEP_TO_SECTION.length}
				</div>
				{currentStep < STEP_TO_SECTION.length - 1 ? (
					<Button
						onClick={() => goToStep(currentStep + 1)}
						className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
					>
						Continue
						<ArrowRight className="w-4 h-4 ml-1.5" />
					</Button>
				) : (
					<Button
						disabled={!allTabsComplete || isSubmitting || isSavingDraft}
						className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
						onClick={handleSubmit}
					>
						<Check className="w-4 h-4 mr-1.5" />
						{isSubmitting ? "Creating..." : "Finalise Case"}
					</Button>
				)}
			</div>
		</div>
	);

	return (
		<WizardLayout
			formPanel={formPanel}
			previewPanel={<WizardPreviewPanel />}
			showPreview={showPreview}
			onTogglePreview={() => setShowPreview((prev) => !prev)}
		/>
	);
});

export const CreateCase = () => {
	return (
		<CaseStoresProvider>
			<Head title="Create Case" />
			<CreateCaseContent />
		</CaseStoresProvider>
	);
};
