export interface ICertificateTestData {
	certificate_number: string;
	police_number: string;
	approved_botanist: string;
	defendantFirstName: string;
	defendantLastName: string;
	additional_notes: string;
	certified_date: string;
}

export interface ResponseData {
	status: string;
	message: string;
}
