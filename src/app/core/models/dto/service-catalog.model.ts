export interface ServiceCatalog {
    id: number;
    name: string;
    description?: string | null;
    base_price: number;
    active: boolean;
    created_at: string;
}
