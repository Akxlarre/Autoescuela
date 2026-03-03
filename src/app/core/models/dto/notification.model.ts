export interface Notification {
    id: number;
    recipient_id?: number | null;
    type?: string | null;
    subject?: string | null;
    message: string;
    read: boolean;
    sent_at?: string | null;
    sent_ok: boolean;
    send_error?: string | null;
    reference_type?: string | null;
    reference_id?: number | null;
    created_at: string;
}
