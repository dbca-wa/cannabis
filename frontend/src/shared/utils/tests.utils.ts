import { apiClient } from "../services";
import type { ICertificateTestData, ResponseData } from "../types/tests.types";

export const generateTestCertificate = async (data: ICertificateTestData) => {
	return apiClient.post<ResponseData>(`cases/certificates/test/generate`, data);
};
