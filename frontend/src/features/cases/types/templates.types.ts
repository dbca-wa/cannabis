/**
 * Section C note template types.
 */

export interface ISectionCTemplate {
	id: number;
	name: string;
	content: string;
	created_at: string;
	updated_at: string;
}

export interface ISectionCTemplateCreate {
	name: string;
	content: string;
}

export interface ISectionCTemplateUpdate {
	name?: string;
	content?: string;
}
