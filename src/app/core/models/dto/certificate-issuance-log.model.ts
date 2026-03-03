export interface CertificateIssuanceLog {
    id: number;
    certificate_id?: number | null;
    action?: string | null;
    user_id?: number | null;
    ip?: string | null;
    created_at: string;
}
