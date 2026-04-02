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
}

export interface VehicleOption {
  id: number;
  licensePlate: string;
  label: string;
  status: 'available' | 'assigned' | 'maintenance';
}

export interface VehicleAssignmentHistory {
  id: number;
  vehiclePlate: string;
  vehicleModel: string;
  startDate: string;
  endDate: string | null;
  assignedBy: string | null;
}
