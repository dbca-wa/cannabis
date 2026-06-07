/**
 * Container component for managing a botanist's digital signature.
 * Provides a tabbed interface for uploading or drawing a signature,
 * a preview of the current signature, and a delete action with confirmation.
 */

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
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

import { useSignature, useDeleteSignature, useSignatureImage } from "../hooks";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { SignaturePreview } from "./SignaturePreview";
import { SignatureUploader } from "./SignatureUploader";
import { SignatureCanvas } from "./SignatureCanvas";

export const SignatureManager = () => {
	const [activeTab, setActiveTab] = useState("upload");
	const { user } = useAuth();
	const { data: signature } = useSignature();
	const deleteMutation = useDeleteSignature();

	const hasSignature = !!signature?.image_url;
	const { blobUrl } = useSignatureImage(hasSignature, signature?.updated_at);

	const botanistName = user
		? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Botanist"
		: "Botanist";

	const handleDelete = async () => {
		await deleteMutation.mutateAsync();
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Digital Signature</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<SignaturePreview
					signatureUrl={blobUrl ?? null}
					botanistName={botanistName}
				/>

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList>
						<TabsTrigger value="upload">Upload</TabsTrigger>
						<TabsTrigger value="draw">Draw</TabsTrigger>
					</TabsList>
					<TabsContent value="upload">
						<SignatureUploader />
					</TabsContent>
					<TabsContent value="draw">
						<SignatureCanvas />
					</TabsContent>
				</Tabs>

				{hasSignature && (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="destructive"
								size="sm"
								disabled={deleteMutation.isPending}
							>
								{deleteMutation.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Trash2 className="mr-2 h-4 w-4" />
								)}
								{deleteMutation.isPending ? "Deleting…" : "Delete signature"}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete signature?</AlertDialogTitle>
								<AlertDialogDescription>
									This will permanently remove your digital signature. You will
									need to upload or draw a new one before signing any
									certificates.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={handleDelete}>
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				)}
			</CardContent>
		</Card>
	);
};
