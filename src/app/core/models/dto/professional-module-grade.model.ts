export interface ProfessionalModuleGrade {
    id: number;
    enrollment_id?: number | null;
    module: string;
    grade?: number | null;
    passed?: boolean | null;
    template_id?: number | null;
    recorded_by?: number | null;
    created_at: string;
    updated_at: string;
}
