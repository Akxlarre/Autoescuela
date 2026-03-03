export interface User {
    id: number;
    supabase_uid?: string | null;
    rut: string;
    first_names: string;
    paternal_last_name: string;
    maternal_last_name: string;
    email: string;
    phone?: string | null;
    role_id?: number | null;
    branch_id?: number | null;
    can_access_both_branches: boolean;
    active: boolean;
    first_login: boolean;
    created_at: string;
    updated_at: string;
}
