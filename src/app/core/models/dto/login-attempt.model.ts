export interface LoginAttempt {
    id: number;
    email: string;
    ip?: string | null;
    successful?: boolean | null;
    user_id?: number | null;
    created_at: string;
}
