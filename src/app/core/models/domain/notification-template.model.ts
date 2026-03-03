export interface NotificationTemplate {
    id: number;
    name: string;
    type?: string | null;
    subject?: string | null;
    body: string;
    active: boolean;
    created_at: string;
}
