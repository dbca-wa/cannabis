// Batch domain types — matches Django Batch model and serializers

export interface BatchCaseTiny {
	id: number;
	case_number: string;
	bags_count: number;
	certificate_count: number;
}

export interface Batch {
	id: number;
	batch_number: string;
	date_batched: string;
	certificate_count: number;
	bag_count: number;
	cert_rate: string;
	bag_rate: string;
	tax_percentage: string;
	cert_cost: string;
	bag_cost: string;
	subtotal: string;
	tax_amount: string;
	total: string;
	certificate_number_range: string;
	certificate_numbers: string[];
	invoice_raised_number: string | null;
	invoice_raised_at: string | null;
	is_invoiced: boolean;
	botanists: string[];
	submitting_officers: string[];
	case_numbers: string[];
	created_at: string;
}

export interface BatchDetail extends Batch {
	cases: BatchCaseTiny[];
	zip_available: boolean;
}

export interface CreateBatchRequest {
	certificate_ids: number[];
}

export interface RecordInvoiceRaisedRequest {
	invoice_raised_number: string;
}

export type BatchOrdering =
	| "created_at"
	| "-created_at"
	| "certificate_count"
	| "-certificate_count"
	| "bag_count"
	| "-bag_count"
	| "total"
	| "-total";
