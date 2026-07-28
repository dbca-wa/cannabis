/**
 * TanStack Query hooks for Section C note templates.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/shared/utils/error.utils";
import {
	getTemplates,
	createTemplate,
	updateTemplate,
	deleteTemplate,
} from "../services/templates.service";
import type {
	ISectionCTemplateCreate,
	ISectionCTemplateUpdate,
} from "../types/templates.types";

export const templateQueryKeys = {
	all: ["sectionCTemplates"] as const,
	list: () => [...templateQueryKeys.all, "list"] as const,
};

/** Fetch all Section C templates. */
export const useSectionCTemplates = () => {
	return useQuery({
		queryKey: templateQueryKeys.list(),
		queryFn: () => getTemplates(),
		staleTime: 5 * 60_000,
	});
};

/** Create a new template. */
export const useCreateTemplate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: ISectionCTemplateCreate) => createTemplate(data),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: templateQueryKeys.all,
			});
			toast.success("Template created");
		},
		onError: (error: Error) => {
			toast.error(getErrorMessage(error) || "Failed to create template");
		},
	});
};

/** Update an existing template. */
export const useUpdateTemplate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ pk, data }: { pk: number; data: ISectionCTemplateUpdate }) =>
			updateTemplate(pk, data),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: templateQueryKeys.all,
			});
			toast.success("Template updated");
		},
		onError: (error: Error) => {
			toast.error(getErrorMessage(error) || "Failed to update template");
		},
	});
};

/** Delete a template. */
export const useDeleteTemplate = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (pk: number) => deleteTemplate(pk),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: templateQueryKeys.all,
			});
			toast.success("Template deleted");
		},
		onError: (error: Error) => {
			toast.error(getErrorMessage(error) || "Failed to delete template");
		},
	});
};
