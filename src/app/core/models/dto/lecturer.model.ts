export interface Lecturer {
    id: number;
    rut: string;
    first_names: string;
    paternal_last_name: string;
    maternal_last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    specializations?: string[] | null;
    active: boolean;
    registration_date?: string | null;
}
