import { apiClient } from "../services";
import type {
	ICertificateTestData,
	IMandrillTestEmailData,
	ResponseData,
} from "../types/tests.types";

export const sendMandrillTestEmail = async (data: IMandrillTestEmailData) => {
	return apiClient.post<ResponseData>(
		`emails/test/mandrill_cannabis_test_email`,
		data
	);
};

export const generateTestCertificate = async (data: ICertificateTestData) => {
	return apiClient.post<ResponseData>(
		`submissions/certificates/test/generate`,
		data
	);
};
