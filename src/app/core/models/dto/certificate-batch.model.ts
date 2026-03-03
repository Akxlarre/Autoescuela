export interface CertificateBatch {
    id: number;
    batch_code: string;
    folio_from: number;
    folio_to: number;
    available_folios?: number | null;
    branch_id?: number | null;
    received_date?: string | null;
    received_by?: number | null;
    created_at: string;
}
