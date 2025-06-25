import { POLICE_SENIORITY_OPTIONS } from "@/components/users/forms/utils";
// User
import { editUserSchema } from "@/components/users/forms/schemas/editUserSchema";
import { addUserSchema } from "@/components/users/forms/schemas/addUserSchema";
// Org
import { editOrganisationSchema } from "@/components/organisations/forms/schemas/editOrganisationSchema";
import { addOrganisationSchema } from "@/components/core/organisations/forms/schemas/addOrganisationSchema";
// Submission
import { editSubmissionSchema } from "@/components/core/submissions/forms/schemas/editSubmissionSchema";
import { addSubmissionSchema } from "@/components/core/submissions/forms/schemas/addSubmissionSchema";
// Certificate
import { editCertificateSchema } from "@/components/core/certificates/forms/schemas/editCertificateSchema";
import { addCertificateSchema } from "@/components/core/certificates/forms/schemas/addCertificateSchema";

export type Role = "botanist" | "police" | "finance" | "none";
export type PoliceSeniority = (typeof POLICE_SENIORITY_OPTIONS)[number];

export interface User {
	id: number;
	username: string;
	email: string;
	role: Role;
	is_staff: boolean;
	is_superuser: boolean;
}

export interface PoliceStation {
	id: number;
	name: string;
	address?: string;
	phone_number?: string;
	email?: string;
	created_at?: string;
	updated_at?: string;
}

export interface SimpleStation {
	id: number;
	name: string;
}

export interface SimpleUser {
	id: number;
	first_name: string;
	last_name: string;
}

export interface IPoliceData {
	user: SimpleUser;
	station: SimpleStation | null;
	police_id: string;
	sworn: boolean;
	seniority: PoliceSeniority;
}

export interface UserDetail extends User {
	is_active: boolean;
	first_name: string;
	last_name: string;
	date_joined: Date;
	groups: [];
	user_permissions: [];
	police_data: IPoliceData | null; // Can be null
	// Additional flat fields for form compatibility
	police_id?: string;
	station_id?: number | null;
	rank?: string;
	is_sworn?: boolean;
}

export type AuthState = {
	user: User | null;
	// token: string | null;
	loading: boolean;
	error: string | null;
};

export interface Submission {
	id: number;
	police_officer: {
		id: number;
		user: {
			id: number;
			username: string;
			first_name: string;
			last_name: string;
		};
		police_id: string;
		seniority: string;
		sworn: boolean;
	};
	police_submitter?: {
		id: number;
		user: {
			id: number;
			username: string;
			first_name: string;
			last_name: string;
		};
		police_id: string;
		seniority: string;
		sworn: boolean;
	} | null;
	dbca_submitter?: {
		id: number;
		user: {
			id: number;
			username: string;
			first_name: string;
			last_name: string;
		};
		role: string;
	} | null;
	baggies?: Baggy[];
	certificates?: Certificate[];
	created_at: string;
	updated_at: string;
}

export interface Baggy {
	id: number;
	submission: number; // submission ID
	item_type:
		| "seed"
		| "seedling"
		| "plant"
		| "plant_striking"
		| "poppy_capsule"
		| "stem"
		| "root_ball"
		| "mushroom"
		| "tin"
		| "unknown";
	units: number;
	police_reference_number: string;
	police_property_number: string;
	seal_no: string;
	new_seal_no: string;
	botanist_determination: "degraded" | "cannabis";
	created_at: string;
	updated_at: string;
}

export interface Certificate {
	id: number;
	submission: number; // submission ID
	identification_fee: number;
	created_at: string;
	updated_at: string;
}

export interface SubmissionsResponse {
	submissions?: Submission[];
	total_results?: number;
	total_pages?: number;
}

export interface CreateUserRequest {
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	role: Role;
	// Police profile fields
	police_id?: string;
	station_id?: number | null;
	rank?: string;
	is_sworn?: boolean;
}

// SCHEMAS
export type EditUserFormData = z.infer<typeof editUserSchema>;
export type AddUserFormData = z.infer<typeof addUserSchema>;

export type EditOrganisationFormData = z.infer<typeof editOrganisationSchema>;
export type AddOrganisationFormData = z.infer<typeof addOrganisationSchema>;

export type EditSubmissionFormData = z.infer<typeof editSubmissionSchema>;
export type AddSubmissionFormData = z.infer<typeof addSubmissionSchema>;

export type EditCertificateFormData = z.infer<typeof editCertificateSchema>;
export type AddCertificateFormData = z.infer<typeof addCertificateSchema>;
