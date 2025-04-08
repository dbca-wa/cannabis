// api/submissionsApi.ts
import axiosInstance from "./axiosInstance";

export const submissionsApi = {
	getSubmissions: async (params?: any) => {
		const response = await axiosInstance.get("/submissions/", { params });
		return response.data;
	},

	getSubmissionById: async (id: number | string) => {
		const response = await axiosInstance.get(`/submissions/${id}/`);
		return response.data;
	},

	createSubmission: async (submissionData: any) => {
		const response = await axiosInstance.post(
			"/submissions/",
			submissionData
		);
		return response.data;
	},

	updateSubmission: async (id: number | string, submissionData: any) => {
		const response = await axiosInstance.put(
			`/submissions/${id}/`,
			submissionData
		);
		return response.data;
	},

	deleteSubmission: async (id: number | string) => {
		const response = await axiosInstance.delete(`/submissions/${id}/`);
		return response.data;
	},
};
