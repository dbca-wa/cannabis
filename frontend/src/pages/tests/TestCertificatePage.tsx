// Route for testing certificate generation flow
import { Head } from "@/shared/components/layout/Head";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
	AlertCircle,
	CheckCircle2,
	ExternalLink,
	FileText,
	PenTool,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { logger, SectionWrapper } from "@/shared";
import { toast } from "sonner";
import { generateTestCertificate } from "@/shared/utils/tests.utils";
import { useSignature } from "@/features/signatures/hooks";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useState } from "react";
import { Link } from "react-router";

// Zod schema for the certificate test form
const certificateTestGenSchema = z.object({
	certificate_number: z.string().min(5, "5 characters only"),
	police_number: z.string().min(1, "Police number required"),
	approved_botanist: z.string().min(1, "Need an approved botanist"),
	defendantFirstName: z.string().min(1, "Defendant first name required"),
	defendantLastName: z.string().min(1, "Defendant last name required"),
	additional_notes: z.string(),
	certified_date: z.string().min(1, "Date required"),
});

type CertificateTestGenFormData = z.infer<typeof certificateTestGenSchema>;

// Quick action links displayed above the form
const QuickActions = ({
	userId,
	isBotanist,
}: {
	userId: number;
	isBotanist: boolean;
}) => (
	<div className="flex flex-wrap gap-3">
		{isBotanist && (
			<Link
				to={`/users/${userId}`}
				className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
			>
				<PenTool className="h-4 w-4" />
				Manage Signature
			</Link>
		)}
		<Link
			to="/docs/certificates"
			className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
		>
			<FileText className="h-4 w-4" />
			View All Certificates
		</Link>
	</div>
);

// Result panel shown after generating an unsigned certificate
const GenerationResult = ({
	isBotanist,
	hasSignature,
	userId,
}: {
	isBotanist: boolean;
	hasSignature: boolean;
	userId: number;
}) => (
	<div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-5">
		<div className="flex items-start gap-3">
			<CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
			<div className="space-y-1">
				<p className="font-medium text-green-800">
					Unsigned certificate generated and downloaded
				</p>
				<p className="text-sm text-green-700">
					The PDF has been saved to your downloads folder.
				</p>
			</div>
		</div>

		<div className="space-y-3 rounded-md border border-green-300 bg-white p-4">
			<h3 className="text-sm font-semibold text-gray-800">Next Steps</h3>
			<div className="flex items-center gap-2 text-sm text-gray-600">
				<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
					✓
				</span>
				<span>Generate unsigned certificate</span>
			</div>
			<div className="flex items-center gap-2 text-sm text-gray-600">
				<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
					2
				</span>
				<span>
					Sign the certificate via{" "}
					<Link
						to="/docs/certificates"
						className="font-medium text-blue-600 underline hover:text-blue-800"
					>
						Docs → Certificates
					</Link>
				</span>
			</div>
			<div className="flex items-center gap-2 text-sm text-gray-600">
				<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
					3
				</span>
				<span>Download the signed PDF</span>
			</div>
		</div>

		{isBotanist && !hasSignature && (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					You need to{" "}
					<Link to={`/users/${userId}`} className="font-medium underline">
						upload a signature
					</Link>{" "}
					before you can sign certificates.
				</AlertDescription>
			</Alert>
		)}

		{isBotanist && hasSignature && (
			<div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
				<ExternalLink className="h-4 w-4" />
				<span>
					Your signature is ready. Head to{" "}
					<Link to="/docs/certificates" className="font-medium underline">
						Docs → Certificates
					</Link>{" "}
					to sign the generated certificate.
				</span>
			</div>
		)}
	</div>
);

const TestCertificatePage = () => {
	const { user } = useAuth();
	const { data: signature, isLoading: isSignatureLoading } = useSignature();
	const [hasGenerated, setHasGenerated] = useState(false);

	const isBotanist = user?.role === "botanist";
	const hasSignature = !!signature?.image_url;
	const signatureMissing = isBotanist && !isSignatureLoading && !hasSignature;

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
		onSuccess: (data) => {
			toast.dismiss();
			toast.success("Success", {
				description: data.message,
			});
			setHasGenerated(true);
			reset();
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

	return (
		<>
			<Head title="Certificate Test" />
			<div className="mb-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => window.history.back()}
					className="cursor-pointer"
				>
					← Back to Tests
				</Button>
			</div>

			<SectionWrapper>
				<div className="mx-auto max-w-2xl p-6">
					<h1 className="mb-4 text-2xl font-bold">
						Test Certificate Generation
					</h1>

					{user && (
						<div className="mb-6">
							<QuickActions userId={user.id} isBotanist={isBotanist} />
						</div>
					)}

					{signatureMissing && (
						<Alert variant="destructive" className="mb-6">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								You must upload a digital signature before generating
								certificates. Visit your{" "}
								<Link
									to={`/users/${user?.id}`}
									className="underline font-medium"
								>
									profile
								</Link>{" "}
								to upload or draw a signature.
							</AlertDescription>
						</Alert>
					)}

					{hasGenerated && user && (
						<div className="mb-6">
							<GenerationResult
								isBotanist={isBotanist}
								hasSignature={hasSignature}
								userId={user.id}
							/>
						</div>
					)}

					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						<div className="space-y-4 border-b pb-4">
							<h2 className="text-lg font-semibold">Certificate Information</h2>

							<div>
								<Label htmlFor="certificate_number">Certificate Number</Label>
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
								<Label htmlFor="police_number">Police Number</Label>
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
								<Label htmlFor="approved_botanist">Approved Botanist</Label>
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
								<Label htmlFor="certified_date">Certified Date</Label>
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

						<div className="space-y-4 border-b pb-4">
							<h2 className="text-lg font-semibold">Defendant Information</h2>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="defendantFirstName">First Name</Label>
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
									<Label htmlFor="defendantLastName">Last Name</Label>
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
								isSubmitting ||
								testCertGenMutation.isPending ||
								signatureMissing
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
		</>
	);
};

export default TestCertificatePage;
