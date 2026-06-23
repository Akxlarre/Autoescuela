export interface DashboardModel {
    hero?: HeroModel;
    kpis: KpiModel[];
    activities: ActivityModel[];
    alerts: AlertModel[];
    quickActions: QuickActionModel[];
    systemStatus: SystemStatusModel[];
    liveClasses?: LiveClassModel[];
}

export interface HeroModel {
    userName: string;
    date: string;
    classesToday: number;
    practicalClasses: number;
    theoreticalClasses: number;
    activeAlerts: number;
}

export interface KpiModel {
    id: string;
    label: string;
    value: number;
    trend?: number;
    trendLabel?: string;
    trendSuffix?: string;
    icon: string;
    color?: 'default' | 'success' | 'warning' | 'error';
    subValue?: string;
    prefix?: string;
    suffix?: string;
    accent?: boolean;
}

export interface ActivityModel {
    id: string;
    icon: string;
    title: string;
    description: string;
    time: string;
    iconBg?: string;
    iconColor?: string;
}

export interface AlertModel {
    id: string;
    title: string;
    description: string;
    severity: 'error' | 'warning' | 'info' | 'success';
}

export interface QuickActionModel {
    id: string;
    icon?: string;
    label: string;
    llmAction: string;
    iconBg?: string;
    iconColor?: string;
}

export interface SystemStatusModel {
    name: string;
    ok: boolean;
}

export interface LiveClassModel {
    id: string;
    originalId: number;
    classNumber?: number;
    studentName: string;
    instructorName: string;
    timeLabel: string; // ej. "10:00 - 10:45"
    status: 'pending' | 'in_progress' | 'completed';
    type: 'practical' | 'theoretical';
    vehicle?: string; // Opcional (concatenado para dashboard UI)
    vehiclePlate?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    scheduledAt: string; // ISO date string
}
