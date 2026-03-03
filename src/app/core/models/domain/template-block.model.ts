export interface TemplateBlock {
    id: number;
    template_id: number;
    type: string;
    week_number: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    description?: string | null;
}
