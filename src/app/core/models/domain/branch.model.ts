export interface Branch {
    id: number;
    name: string;
    slug: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    active: boolean;
    created_at: string;
}
