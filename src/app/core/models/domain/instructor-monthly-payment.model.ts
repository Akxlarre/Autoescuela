export interface InstructorMonthlyPayment {
    id: number;
    instructor_id: number;
    period: string;
    base_salary: number;
    advances_deducted: number;
    net_payment: number;
    payment_status: string;
    paid_at?: string | null;
    paid_by?: number | null;
    notes?: string | null;
}
