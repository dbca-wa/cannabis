/**
 * Dedicated page for managing the current user's digital signature.
 * Accessible via the user menu for botanists and superusers.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import {
	ArrowLeft,
	X,
	Upload,
	PenLine,
	CheckCircle2,
	ImageOff,
} from "lucide-react";

import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";

import {
	useSignature,
	useDeleteSignature,
	useSignatureImage,
} from "@/features/signatures/hooks";
import { SignatureUploader } from "@/features/signatures/components/SignatureUploader";
import { SignatureCanvas } from "@/features/signatures/components/SignatureCanvas";
import { SignaturePreview } from "@/features/signatures/components/SignaturePreview";
import { useAuth } from "@/features/auth/hooks/useAuth";

const SignaturePage = () => {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState("draw");
	const { user } = useAuth();
	const { data: signature, isLoading } = useSignature();
	const deleteMutation = useDeleteSignature();
	const hasSignature = !!signature?.image_url;
	const { blobUrl, isLoading: imageLoading } = useSignatureImage(
		hasSignature,
		signature?.updated_at
	);
	useDocumentTitle("My Signature");

	const botanistName = user
		? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Botanist"
		: "Botanist";

	return (
		<div className="flex flex-col h-full">
			{/* Minimal back header */}
			<div className="px-6 py-4 border-b border-border/60">
				<button
					onClick={() => navigate(-1)}
					className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</button>
			</div>

			<div className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-5xl px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left column: Signature editor */}
					<div>
						{/* Title */}
						<div className="mb-8">
							<h1 className="text-2xl font-semibold tracking-tight">
								Digital Signature
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								Your signature is embedded into certificates when you sign them.
							</p>
						</div>

						{/* Current signature preview */}
						<div className="mb-8">
							<div className="flex items-center justify-between mb-3">
								<h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
									Current Signature
								</h2>
								{hasSignature && (
									<span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
										<CheckCircle2 className="h-3.5 w-3.5" />
										On file
									</span>
								)}
							</div>

							{isLoading || imageLoading ? null : hasSignature && blobUrl ? (
								<div
									className="relative w-full rounded-xl border border-border bg-white overflow-hidden"
									style={{ aspectRatio: "3 / 1" }}
								>
									<img
										src={blobUrl}
										alt="Your digital signature"
										className="w-full h-full object-cover"
									/>
									{/* Circular delete button — top right */}
									<AlertDialog>
										<Tooltip>
											<TooltipTrigger asChild>
												<AlertDialogTrigger asChild>
													<button
														className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-colors"
														disabled={deleteMutation.isPending}
													>
														<X className="h-3.5 w-3.5" />
													</button>
												</AlertDialogTrigger>
											</TooltipTrigger>
											<TooltipContent side="left">
												Delete signature
											</TooltipContent>
										</Tooltip>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>Delete signature?</AlertDialogTitle>
												<AlertDialogDescription>
													This will permanently remove your digital signature.
													You'll need to upload or draw a new one before signing
													any certificates.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													onClick={() => deleteMutation.mutateAsync()}
												>
													Delete
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							) : (
								<div
									className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border border-dashed border-border/70 bg-muted/10"
									style={{ aspectRatio: "3 / 1" }}
								>
									<ImageOff className="h-8 w-8 text-muted-foreground/40" />
									<p className="text-sm text-muted-foreground">
										No signature on file
									</p>
								</div>
							)}
						</div>

						{/* Upload / Draw tabs */}
						<div>
							<h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
								{hasSignature ? "Replace Signature" : "Add Signature"}
							</h2>
							<Tabs value={activeTab} onValueChange={setActiveTab}>
								<TabsList className="w-full">
									<TabsTrigger value="draw" className="flex-1 gap-2">
										<PenLine className="h-4 w-4" />
										Draw
									</TabsTrigger>
									<TabsTrigger value="upload" className="flex-1 gap-2">
										<Upload className="h-4 w-4" />
										Upload
									</TabsTrigger>
								</TabsList>
								<TabsContent value="draw" className="mt-4">
									<SignatureCanvas />
								</TabsContent>
								<TabsContent value="upload" className="mt-4">
									<SignatureUploader />
								</TabsContent>
							</Tabs>
						</div>
					</div>

					{/* Right column: Certificate preview */}
					<div className="lg:sticky lg:top-10 lg:self-start">
						<SignaturePreview
							signatureUrl={blobUrl}
							botanistName={botanistName}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SignaturePage;
