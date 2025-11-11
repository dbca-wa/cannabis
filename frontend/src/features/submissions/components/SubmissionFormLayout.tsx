import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { cn } from "@/shared/utils/style.utils";
import { useSubmissionFormStore } from "@/features/submissions/hooks/useSubmissionFormStore";
import { useCertificatePreviewStore } from "@/features/submissions/hooks/useCertificatePreviewStore";
import { ViewSwitcher } from "./ViewSwitcher";
import { useBreakpoint } from "@/shared/hooks/ui/useResponsive";
import type { ViewMode } from "@/features/submissions/stores/submissionForm.store";

interface SubmissionFormLayoutProps {
	formContent: React.ReactNode;
	previewContent: React.ReactNode;
	showViewSwitcher?: boolean;
	title?: string;
	subtitle?: string;
	className?: string;
}

export const SubmissionFormLayout: React.FC<SubmissionFormLayoutProps> =
	observer(
		({
			formContent,
			previewContent,
			showViewSwitcher = true,
			title,
			subtitle,
			className,
		}) => {
			const formStore = useSubmissionFormStore();
			const previewStore = useCertificatePreviewStore();
			const { isMobile, isTablet } = useBreakpoint();

			const currentView = formStore.currentView;

			// Update preview data when form data changes
			useEffect(() => {
				if (formStore.requiredFieldsCompleted) {
					previewStore.setPreviewData(formStore.certificateData);
				}
			}, [
				formStore.certificateData,
				formStore.requiredFieldsCompleted,
				previewStore,
			]);

			// Handle keyboard shortcuts for view switching
			useEffect(() => {
				const handleKeyPress = (e: KeyboardEvent) => {
					// Alt + 1: Data Entry
					if (e.altKey && e.key === "1") {
						e.preventDefault();
						formStore.setView("data-entry");
					}
					// Alt + 2: Dual View
					else if (e.altKey && e.key === "2") {
						e.preventDefault();
						formStore.setView("dual-view");
					}
					// Alt + 3: Preview Only
					else if (e.altKey && e.key === "3") {
						e.preventDefault();
						formStore.setView("preview-only");
					}
				};

				window.addEventListener("keydown", handleKeyPress);
				return () =>
					window.removeEventListener("keydown", handleKeyPress);
			}, [formStore]);

			// Force data-entry view on mobile/tablet if currently in dual-view
			useEffect(() => {
				if ((isMobile || isTablet) && currentView === "dual-view") {
					formStore.setView("data-entry");
				}
			}, [isMobile, isTablet, currentView, formStore]);

			const handleViewChange = (view: ViewMode) => {
				// Prevent dual-view on mobile/tablet (but allow preview-only)
				if ((isMobile || isTablet) && view === "dual-view") {
					return;
				}
				formStore.setView(view);
			};

			// Render header with title and view switcher
			const renderHeader = () => {
				if (!showViewSwitcher && !title) return null;

				return (
					<div className="space-y-4 mb-6">
						{/* Title Section */}
						{title && (
							<div>
								<h1 className="text-2xl font-bold">{title}</h1>
								{subtitle && (
									<p className="text-muted-foreground mt-1">
										{subtitle}
									</p>
								)}
							</div>
						)}

						{/* View Switcher + Status Section - Full width */}
						{showViewSwitcher && (
							<div className="space-y-2">
								{/* Status indicators */}
								{(formStore.isDirty || formStore.lastSaved) && (
									<div className="flex items-center gap-3 text-xs text-muted-foreground">
										{formStore.isDirty && (
											<span>(Unsaved changes)</span>
										)}
										{formStore.lastSaved && (
											<span>
												Last saved:{" "}
												{formStore.lastSaved.toLocaleTimeString()}
											</span>
										)}
									</div>
								)}

								{/* View Switcher - Full width */}
								<ViewSwitcher
									currentView={currentView}
									onViewChange={handleViewChange}
									disableDualView={isMobile || isTablet}
								/>

								{/* Keyboard shortcuts hint - Desktop only */}
								{!isMobile && !isTablet && (
									<div className="text-xs text-muted-foreground text-center">
										Keyboard shortcuts: Alt+1 (Form), Alt+2
										(Both), Alt+3 (Preview)
									</div>
								)}
							</div>
						)}

						{/* Mobile/Tablet notice */}
						{(isMobile || isTablet) && showViewSwitcher && (
							<div className="text-xs text-muted-foreground p-2 bg-muted rounded">
								Dual view is disabled on mobile/tablet devices.
								Use Form or Preview modes, or switch to desktop
								for side-by-side view.
							</div>
						)}
					</div>
				);
			};

			// Render based on current view mode
			const renderContent = () => {
				switch (currentView) {
					case "data-entry":
						return (
							<div className="w-full transition-opacity duration-200">
								{formContent}
							</div>
						);

					case "preview-only":
						return (
							<div className="w-full transition-opacity duration-200">
								{previewContent}
							</div>
						);

					case "dual-view":
						return (
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-200">
								{/* Form Panel - No scrollbar, page scrolls naturally */}
								<div className="transition-opacity duration-200">
									{formContent}
								</div>

								{/* Preview Panel - Sticky with internal scrollbar */}
								<div className="transition-opacity duration-200">
									<div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-100px)]">
										<div className="rounded-lg border bg-card h-full flex flex-col overflow-hidden">
											<div className="p-4 border-b flex-shrink-0">
												<h3 className="text-sm font-medium dark:text-white">
													Certificate Preview
												</h3>
											</div>
											<div className="flex-1 overflow-hidden">
												{previewContent}
											</div>
										</div>
									</div>
								</div>
							</div>
						);

					default:
						return formContent;
				}
			};

			return (
				<div className={cn("w-full", className)}>
					{renderHeader()}

					{/* Content Area */}
					<div className="relative">{renderContent()}</div>
				</div>
			);
		}
	);

SubmissionFormLayout.displayName = "SubmissionFormLayout";
