import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { submissionsApi } from "@/api/submissionsApi";
import { Baggy, Certificate, Submission } from "@/types";

// Hook for getting a single submission by ID
export const useSubmissionById = (id: string | number) => {
	const submissionQuery = useQuery({
		queryKey: ["submission", id],
		queryFn: () => submissionsApi.getSubmissionById(id),
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 2 * 60 * 1000, // 2 minutes
		enabled: !!id,
	});

	return {
		submission: submissionQuery.data as Submission,
		isLoading: submissionQuery.isLoading,
		error: submissionQuery.error,
		refetch: submissionQuery.refetch,
	};
};

// Hook for getting submission with all related data (baggies + certificates)
export const useSubmissionWithDetails = (id: string | number) => {
	const submissionQuery = useQuery({
		queryKey: ["submissionWithDetails", id],
		queryFn: () => submissionsApi.getSubmissionWithDetails(id),
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 2 * 60 * 1000, // 2 minutes
		enabled: !!id,
	});

	return {
		submission: submissionQuery.data,
		isLoading: submissionQuery.isLoading,
		error: submissionQuery.error,
		refetch: submissionQuery.refetch,
	};
};

// Hook for getting baggies
export const useBaggies = (submissionId?: string | number) => {
	const baggiesQuery = useQuery({
		queryKey: submissionId
			? ["baggies", "submission", submissionId]
			: ["baggies"],
		queryFn: () => submissionsApi.getBaggies(submissionId),
		staleTime: 30 * 1000,
		gcTime: 2 * 60 * 1000,
	});

	return {
		baggies: (baggiesQuery.data || []) as Baggy[],
		isLoading: baggiesQuery.isLoading,
		error: baggiesQuery.error,
		refetch: baggiesQuery.refetch,
	};
};

// Hook for getting a single baggy by ID
export const useBaggyById = (id: string | number) => {
	const baggyQuery = useQuery({
		queryKey: ["baggy", id],
		queryFn: () => submissionsApi.getBaggyById(id),
		staleTime: 30 * 1000,
		gcTime: 2 * 60 * 1000,
		enabled: !!id,
	});

	return {
		baggy: baggyQuery.data as Baggy,
		isLoading: baggyQuery.isLoading,
		error: baggyQuery.error,
		refetch: baggyQuery.refetch,
	};
};

// Hook for getting certificates
export const useCertificates = (submissionId?: string | number) => {
	const certificatesQuery = useQuery({
		queryKey: submissionId
			? ["certificates", "submission", submissionId]
			: ["certificates"],
		queryFn: () => submissionsApi.getCertificates(submissionId),
		staleTime: 30 * 1000,
		gcTime: 2 * 60 * 1000,
	});

	return {
		certificates: (certificatesQuery.data || []) as Certificate[],
		isLoading: certificatesQuery.isLoading,
		error: certificatesQuery.error,
		refetch: certificatesQuery.refetch,
	};
};

// Hook for getting a single certificate by ID
export const useCertificateById = (id: string | number) => {
	const certificateQuery = useQuery({
		queryKey: ["certificate", id],
		queryFn: () => submissionsApi.getCertificateById(id),
		staleTime: 30 * 1000,
		gcTime: 2 * 60 * 1000,
		enabled: !!id,
	});

	return {
		certificate: certificateQuery.data as Certificate,
		isLoading: certificateQuery.isLoading,
		error: certificateQuery.error,
		refetch: certificateQuery.refetch,
	};
};

// Main submissions hook with CRUD operations
export const useSubmissions = (params?: any) => {
	const queryClient = useQueryClient();

	// Get all submissions
	const submissionsQuery = useQuery({
		queryKey: ["submissions", params],
		queryFn: () => submissionsApi.getSubmissions(params),
		staleTime: 30 * 1000,
		gcTime: 2 * 60 * 1000,
	});

	// Submission mutations
	const createSubmissionMutation = useMutation({
		mutationFn: submissionsApi.createSubmission,
		onSuccess: (newSubmission) => {
			console.log("Submission created successfully:", newSubmission.id);
			queryClient.invalidateQueries({ queryKey: ["submissions"] });
			if (newSubmission.id) {
				queryClient.setQueryData(
					["submission", newSubmission.id],
					newSubmission
				);
			}
		},
	});

	const updateSubmissionMutation = useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string | number;
			data: Partial<Submission>;
		}) => submissionsApi.updateSubmission(id, data),
		onSuccess: (updatedSubmission, variables) => {
			console.log("Submission updated successfully:", variables.id);

			// Invalidate all related queries
			queryClient.invalidateQueries({ queryKey: ["submissions"] });
			queryClient.invalidateQueries({
				queryKey: ["submission", variables.id],
			});
			queryClient.invalidateQueries({
				queryKey: ["submissionWithDetails", variables.id],
			});

			// Update cache
			if (updatedSubmission) {
				queryClient.setQueryData(
					["submission", variables.id],
					updatedSubmission
				);
			}

			// Force fresh fetch
			queryClient.removeQueries({
				queryKey: ["submission", variables.id],
			});
		},
	});

	const deleteSubmissionMutation = useMutation({
		mutationFn: submissionsApi.deleteSubmission,
		onSuccess: (_, deletedSubmissionId) => {
			console.log(
				"Submission deleted successfully:",
				deletedSubmissionId
			);
			queryClient.invalidateQueries({ queryKey: ["submissions"] });
			queryClient.removeQueries({
				queryKey: ["submission", deletedSubmissionId],
			});
			queryClient.removeQueries({
				queryKey: ["submissionWithDetails", deletedSubmissionId],
			});
			// Also invalidate related baggies and certificates
			queryClient.invalidateQueries({
				queryKey: ["baggies", "submission", deletedSubmissionId],
			});
			queryClient.invalidateQueries({
				queryKey: ["certificates", "submission", deletedSubmissionId],
			});
		},
	});

	// Baggy mutations
	const createBaggyMutation = useMutation({
		mutationFn: submissionsApi.createBaggy,
		onSuccess: (newBaggy) => {
			console.log("Baggy created successfully:", newBaggy.id);
			queryClient.invalidateQueries({ queryKey: ["baggies"] });
			queryClient.invalidateQueries({
				queryKey: ["submissionWithDetails", newBaggy.submission],
			});
			if (newBaggy.id) {
				queryClient.setQueryData(["baggy", newBaggy.id], newBaggy);
			}
		},
	});

	const updateBaggyMutation = useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string | number;
			data: Partial<Baggy>;
		}) => submissionsApi.updateBaggy(id, data),
		onSuccess: (updatedBaggy, variables) => {
			console.log("Baggy updated successfully:", variables.id);
			queryClient.invalidateQueries({ queryKey: ["baggies"] });
			queryClient.invalidateQueries({
				queryKey: ["baggy", variables.id],
			});
			if (updatedBaggy) {
				queryClient.invalidateQueries({
					queryKey: [
						"submissionWithDetails",
						updatedBaggy.submission,
					],
				});
				queryClient.setQueryData(["baggy", variables.id], updatedBaggy);
			}
			queryClient.removeQueries({ queryKey: ["baggy", variables.id] });
		},
	});

	const deleteBaggyMutation = useMutation({
		mutationFn: submissionsApi.deleteBaggy,
		onSuccess: (_, deletedBaggyId) => {
			console.log("Baggy deleted successfully:", deletedBaggyId);
			queryClient.invalidateQueries({ queryKey: ["baggies"] });
			queryClient.removeQueries({ queryKey: ["baggy", deletedBaggyId] });
			// TODO: Potentially invalidate the submission it belonged to
		},
	});

	// Certificate mutations
	const createCertificateMutation = useMutation({
		mutationFn: submissionsApi.createCertificate,
		onSuccess: (newCertificate) => {
			console.log("Certificate created successfully:", newCertificate.id);
			queryClient.invalidateQueries({ queryKey: ["certificates"] });
			queryClient.invalidateQueries({
				queryKey: ["submissionWithDetails", newCertificate.submission],
			});
			if (newCertificate.id) {
				queryClient.setQueryData(
					["certificate", newCertificate.id],
					newCertificate
				);
			}
		},
	});

	const updateCertificateMutation = useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string | number;
			data: Partial<Certificate>;
		}) => submissionsApi.updateCertificate(id, data),
		onSuccess: (updatedCertificate, variables) => {
			console.log("Certificate updated successfully:", variables.id);
			queryClient.invalidateQueries({ queryKey: ["certificates"] });
			queryClient.invalidateQueries({
				queryKey: ["certificate", variables.id],
			});
			if (updatedCertificate) {
				queryClient.invalidateQueries({
					queryKey: [
						"submissionWithDetails",
						updatedCertificate.submission,
					],
				});
				queryClient.setQueryData(
					["certificate", variables.id],
					updatedCertificate
				);
			}
			queryClient.removeQueries({
				queryKey: ["certificate", variables.id],
			});
		},
	});

	const deleteCertificateMutation = useMutation({
		mutationFn: submissionsApi.deleteCertificate,
		onSuccess: (_, deletedCertificateId) => {
			console.log(
				"Certificate deleted successfully:",
				deletedCertificateId
			);
			queryClient.invalidateQueries({ queryKey: ["certificates"] });
			queryClient.removeQueries({
				queryKey: ["certificate", deletedCertificateId],
			});
		},
	});

	// Refresh functions
	const refreshSubmissions = async () => {
		await queryClient.invalidateQueries({ queryKey: ["submissions"] });
	};

	const refreshSubmission = async (id: string | number) => {
		await queryClient.invalidateQueries({ queryKey: ["submission", id] });
		await queryClient.invalidateQueries({
			queryKey: ["submissionWithDetails", id],
		});
	};

	const refreshBaggies = async (submissionId?: string | number) => {
		if (submissionId) {
			await queryClient.invalidateQueries({
				queryKey: ["baggies", "submission", submissionId],
			});
		} else {
			await queryClient.invalidateQueries({ queryKey: ["baggies"] });
		}
	};

	const refreshCertificates = async (submissionId?: string | number) => {
		if (submissionId) {
			await queryClient.invalidateQueries({
				queryKey: ["certificates", "submission", submissionId],
			});
		} else {
			await queryClient.invalidateQueries({ queryKey: ["certificates"] });
		}
	};

	return {
		// Queries
		submissions: (submissionsQuery.data || []) as Submission[],
		isLoading: submissionsQuery.isLoading,
		error: submissionsQuery.error,

		// Submission CRUD
		createSubmission: createSubmissionMutation.mutate,
		updateSubmission: updateSubmissionMutation.mutate,
		deleteSubmission: deleteSubmissionMutation.mutate,

		// Baggy CRUD
		createBaggy: createBaggyMutation.mutate,
		updateBaggy: updateBaggyMutation.mutate,
		deleteBaggy: deleteBaggyMutation.mutate,

		// Certificate CRUD
		createCertificate: createCertificateMutation.mutate,
		updateCertificate: updateCertificateMutation.mutate,
		deleteCertificate: deleteCertificateMutation.mutate,

		// Refresh functions
		refreshSubmissions,
		refreshSubmission,
		refreshBaggies,
		refreshCertificates,

		// Mutation states - Submissions
		isCreatingSubmission: createSubmissionMutation.isPending,
		isUpdatingSubmission: updateSubmissionMutation.isPending,
		isDeletingSubmission: deleteSubmissionMutation.isPending,

		// Mutation states - Baggies
		isCreatingBaggy: createBaggyMutation.isPending,
		isUpdatingBaggy: updateBaggyMutation.isPending,
		isDeletingBaggy: deleteBaggyMutation.isPending,

		// Mutation states - Certificates
		isCreatingCertificate: createCertificateMutation.isPending,
		isUpdatingCertificate: updateCertificateMutation.isPending,
		isDeletingCertificate: deleteCertificateMutation.isPending,

		// Errors
		submissionError:
			createSubmissionMutation.error ||
			updateSubmissionMutation.error ||
			deleteSubmissionMutation.error,
		baggyError:
			createBaggyMutation.error ||
			updateBaggyMutation.error ||
			deleteBaggyMutation.error,
		certificateError:
			createCertificateMutation.error ||
			updateCertificateMutation.error ||
			deleteCertificateMutation.error,
	};
};
