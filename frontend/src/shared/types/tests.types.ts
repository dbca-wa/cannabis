export interface IMandrillTestEmailData {
	email_address: string;
	first_name: string;
	last_name: string;
	inviter_email: string;
	inviter_first_name: string;
	inviter_last_name: string;
	invitation_link: string;
	proposed_role: string;
}

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
