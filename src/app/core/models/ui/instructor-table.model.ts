import type { Instructor } from '../dto/instructor.model';

export type InstructorType = 'theory' | 'practice' | 'both';
export type LicenseStatus = 'valid' | 'expiring_soon' | 'expired';

export interface InstructorTableRow {
  id: number;
  userId: number;
  nombre: string;
  initials: string;
  email: string;
  rut: string;
  phone: string;
  tipo: InstructorType;
  tipoLabel: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string | null;
  licenseStatus: LicenseStatus;
  licenseStatusLabel: string;
  activeClassesCount: number;
  estado: 'activo' | 'inactivo';
  registrationDate: string | null;
  // Vehículo asignado (current assignment)
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleId: number | null;
  vehicleAssignmentDate: string | null;
  // Raw fields for editing
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  branchId: number | null;
  bothBranches: boolean;
  /** true = todavía no seteó su contraseña (nunca activó la invitación por correo). */
  firstLogin: boolean;
  /**
   * false = nunca tuvo cuenta de Auth (`supabase_uid IS NULL`). A diferencia de
   * `create-instructor` (que siempre crea la cuenta al mismo tiempo que el registro),
   * una fila insertada fuera de ese flujo (seed, SQL directo) puede no tenerla — ver
   * fix-169-m.
   */
  hasAuthAccount: boolean;
}

export interface VehicleOption {
  id: number;
  licensePlate: string;
  label: string;
  status: 'available' | 'assigned' | 'maintenance';
  branchId: number | null;
  bothBranches: boolean;
}

export interface VehicleAssignmentHistory {
  id: number;
  vehiclePlate: string;
  vehicleModel: string;
  startDate: string;
  endDate: string | null;
  assignedBy: string | null;
}

export interface InstructorHoraRow {
  instructorId: number;
  nombre: string;
  initials: string;
  practicalSessions: number;
  totalEquivalent: number;
}

export interface InstructorHorarioSession {
  id: number;
  scheduledAt: string;
  classNumber: number | null;
  durationMin: number;
  studentName: string;
  studentInitials: string;
  vehiclePlate: string | null;
}
