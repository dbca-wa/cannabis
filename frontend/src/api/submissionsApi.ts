// api/submissionsApi.ts
import { Baggy, Certificate, Submission } from "@/types";
import axiosInstance from "./axiosInstance";

export const submissionsApi = {
	// Submissions CRUD
	getSubmissions: async (params?: any): Promise<Submission[]> => {
		const response = await axiosInstance.get("/submissions/", { params });
		return response.data;
	},

	getSubmissionById: async (id: number | string): Promise<Submission> => {
		const response = await axiosInstance.get(`/submissions/${id}/`);
		return response.data;
	},

	createSubmission: async (
		submissionData: Partial<Submission>
	): Promise<Submission> => {
		const response = await axiosInstance.post(
			"/submissions/",
			submissionData
		);
		return response.data;
	},

	updateSubmission: async (
		id: number | string,
		submissionData: Partial<Submission>
	): Promise<Submission> => {
		const response = await axiosInstance.put(
			`/submissions/${id}/`,
			submissionData
		);
		return response.data;
	},

	deleteSubmission: async (id: number | string): Promise<void> => {
		await axiosInstance.delete(`/submissions/${id}/`);
	},

	// Baggies CRUD (you'll need to create these endpoints)
	getBaggies: async (submissionId?: number | string): Promise<Baggy[]> => {
		const params = submissionId ? { submission: submissionId } : {};
		const response = await axiosInstance.get("/baggies/", { params });
		return response.data;
	},

	getBaggyById: async (id: number | string): Promise<Baggy> => {
		const response = await axiosInstance.get(`/baggies/${id}/`);
		return response.data;
	},

	createBaggy: async (baggyData: Partial<Baggy>): Promise<Baggy> => {
		const response = await axiosInstance.post("/baggies/", baggyData);
		return response.data;
	},

	updateBaggy: async (
		id: number | string,
		baggyData: Partial<Baggy>
	): Promise<Baggy> => {
		const response = await axiosInstance.put(`/baggies/${id}/`, baggyData);
		return response.data;
	},

	deleteBaggy: async (id: number | string): Promise<void> => {
		await axiosInstance.delete(`/baggies/${id}/`);
	},

	// Certificates CRUD (you'll need to create these endpoints)
	getCertificates: async (
		submissionId?: number | string
	): Promise<Certificate[]> => {
		const params = submissionId ? { submission: submissionId } : {};
		const response = await axiosInstance.get("/certificates/", { params });
		return response.data;
	},

	getCertificateById: async (id: number | string): Promise<Certificate> => {
		const response = await axiosInstance.get(`/certificates/${id}/`);
		return response.data;
	},

	createCertificate: async (
		certificateData: Partial<Certificate>
	): Promise<Certificate> => {
		const response = await axiosInstance.post(
			"/certificates/",
			certificateData
		);
		return response.data;
	},

	updateCertificate: async (
		id: number | string,
		certificateData: Partial<Certificate>
	): Promise<Certificate> => {
		const response = await axiosInstance.put(
			`/certificates/${id}/`,
			certificateData
		);
		return response.data;
	},

	deleteCertificate: async (id: number | string): Promise<void> => {
		await axiosInstance.delete(`/certificates/${id}/`);
	},

	// Combined operations
	getSubmissionWithDetails: async (
		id: number | string
	): Promise<
		Submission & { baggies: Baggy[]; certificates: Certificate[] }
	> => {
		const [submission, baggies, certificates] = await Promise.all([
			submissionsApi.getSubmissionById(id),
			submissionsApi.getBaggies(id),
			submissionsApi.getCertificates(id),
		]);

		return {
			...submission,
			baggies,
			certificates,
		};
	},
};
