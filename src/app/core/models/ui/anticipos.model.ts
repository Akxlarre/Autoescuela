export type InstructorTipo = 'theory' | 'practice' | 'both';
export type AdvanceStatus = 'pending' | 'discounted' | 'deducted';

export interface AnticipoCuentaCorriente {
  instructorId: number;
  nombre: string;
  tipo: InstructorTipo | null;
  tipoLabel: string;
  anticiposTotales: number;
  saldoPendiente: number;
  ultimoAnticipo: string | null;
  estado: 'pendiente' | 'al_dia';
}

export interface AnticipoHistorial {
  id: number;
  fecha: string;
  instructorNombre: string;
  motivo: string;
  monto: number;
  estado: AdvanceStatus;
}

export interface AnticiposKpis {
  totalPendiente: number;
  instructoresConSaldo: number;
  totalHistorico: number;
  totalDescontado: number;
}

export interface RegistrarAnticipoPayload {
  instructorId: number;
  date: string;
  amount: number;
  reason: string;
  description: string;
}

export interface InstructorOption {
  id: number;
  nombre: string;
}
