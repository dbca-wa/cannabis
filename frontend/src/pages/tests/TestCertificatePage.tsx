// Route for testing new components
import { Head } from "@/shared/components/layout/Head";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	ContentLayout,
	logger,
	SectionWrapper,
	type BreadcrumbItem,
} from "@/shared";
import { toast } from "sonner";
import { generateTestCertificate } from "@/shared/utils/tests.utils";

// Define Zod schema
const certificateTestGenSchema = z.object({
	certificate_number: z.string().min(5, "5 characters only"),
	police_number: z.string().min(1, "Police number required"),
	approved_botanist: z.string().min(1, "Need an approved botanist"),
	defendantFirstName: z.string().min(1, "Defendant first name required"),
	defendantLastName: z.string().min(1, "Defendant last name required"),
	additional_notes: z.string(),
	certified_date: z.string().min(1, "Date required"),
});

// Type inference from Zod schema
type CertificateTestGenFormData = z.infer<typeof certificateTestGenSchema>;

const TestCertificatePage = () => {
	// React Hook Form setup
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		reset,
	} = useForm<CertificateTestGenFormData>({
		resolver: zodResolver(certificateTestGenSchema),
		defaultValues: {
			certificate_number: "",
			police_number: "",
			approved_botanist: "",
			defendantFirstName: "",
			defendantLastName: "",
			additional_notes: "",
			certified_date: "",
		},
	});

	const testCertGenMutation = useMutation({
		mutationFn: generateTestCertificate,
		onMutate: () => {
			toast.loading("Generating certificate...", {
				description: "One moment!",
			});
		},
		onSuccess: async (data) => {
			toast.dismiss();
			toast.success("Success", {
				description: data.message,
			});
			reset(); // Reset form on success
		},
		onError: (error: Error) => {
			logger.error("Failed to generate certificate", { error });
			toast.dismiss();
			toast.error("Could not generate certificate", {
				description: error.message || "Error generating certificate",
			});
		},
	});

	const onSubmit = (data: CertificateTestGenFormData) => {
		testCertGenMutation.mutate(data);
	};

	const breadcrumbs: BreadcrumbItem[] = [
		{ label: "Tests", href: "/tests" },
		{ label: "Certificates", current: true },
	];
	return (
		<ContentLayout
			breadcrumbs={breadcrumbs}
			showHomeBreadcrumb={true}
			className="space-y-6"
		>
			<Head title="Certificate Test" />
			<SectionWrapper>
				<div className="mx-auto max-w-2xl p-6">
					<h1 className="mb-6 text-2xl font-bold">
						Test Certificate Generation
					</h1>

					<form
						onSubmit={handleSubmit(onSubmit)}
						className="space-y-4"
					>
						{/* Certificate Information */}
						<div className="space-y-4 border-b pb-4">
							<h2 className="text-lg font-semibold">
								Certificate Information
							</h2>

							<div>
								<Label htmlFor="certificate_number">
									Certificate Number
								</Label>
								<Input
									id="certificate_number"
									{...register("certificate_number")}
									placeholder="12345"
								/>
								{errors.certificate_number && (
									<p className="mt-1 text-sm text-red-500">
										{errors.certificate_number.message}
									</p>
								)}
							</div>

							<div>
								<Label htmlFor="police_number">
									Police Number
								</Label>
								<Input
									id="police_number"
									{...register("police_number")}
									placeholder="PD-2024-001"
								/>
								{errors.police_number && (
									<p className="mt-1 text-sm text-red-500">
										{errors.police_number.message}
									</p>
								)}
							</div>

							<div>
								<Label htmlFor="approved_botanist">
									Approved Botanist
								</Label>
								<Input
									id="approved_botanist"
									{...register("approved_botanist")}
									placeholder="Dr. Jane Smith"
								/>
								{errors.approved_botanist && (
									<p className="mt-1 text-sm text-red-500">
										{errors.approved_botanist.message}
									</p>
								)}
							</div>

							<div>
								<Label htmlFor="certified_date">
									Certified Date
								</Label>
								<Input
									id="certified_date"
									type="date"
									{...register("certified_date")}
								/>
								{errors.certified_date && (
									<p className="mt-1 text-sm text-red-500">
										{errors.certified_date.message}
									</p>
								)}
							</div>
						</div>

						{/* Defendant Information */}
						<div className="space-y-4 border-b pb-4">
							<h2 className="text-lg font-semibold">
								Defendant Information
							</h2>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="defendantFirstName">
										First Name
									</Label>
									<Input
										id="defendantFirstName"
										{...register("defendantFirstName")}
										placeholder="John"
									/>
									{errors.defendantFirstName && (
										<p className="mt-1 text-sm text-red-500">
											{errors.defendantFirstName.message}
										</p>
									)}
								</div>

								<div>
									<Label htmlFor="defendantLastName">
										Last Name
									</Label>
									<Input
										id="defendantLastName"
										{...register("defendantLastName")}
										placeholder="Doe"
									/>
									{errors.defendantLastName && (
										<p className="mt-1 text-sm text-red-500">
											{errors.defendantLastName.message}
										</p>
									)}
								</div>
							</div>
						</div>

						{/* Additional Notes */}
						<div>
							<Label htmlFor="additional_notes">
								Additional Notes (Optional)
							</Label>
							<Input
								id="additional_notes"
								{...register("additional_notes")}
								placeholder="Any additional notes..."
							/>
							{errors.additional_notes && (
								<p className="mt-1 text-sm text-red-500">
									{errors.additional_notes.message}
								</p>
							)}
						</div>

						<Button
							type="submit"
							disabled={
								isSubmitting || testCertGenMutation.isPending
							}
							className="w-full"
						>
							{testCertGenMutation.isPending
								? "Generating..."
								: "Generate Certificate"}
						</Button>
					</form>
				</div>
			</SectionWrapper>
		</ContentLayout>
	);
};

export default TestCertificatePage;
