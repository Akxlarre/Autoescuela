/**
 * Modelos para el módulo de Servicios Especiales (RF-037).
 * Punto de venta de servicios complementarios (Psicotécnico, Maquinaria, Informes).
 */

export interface ServicioEspecial {
  /** PK de service_catalog */
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  /** Nombre Lucide en kebab-case (ej. 'brain', 'truck', 'file-text') */
  icono: string;
  color: 'indigo' | 'orange' | 'green';
  activo: boolean;
}

export interface VentaServicio {
  id: number;
  cliente: string;
  rut: string;
  esAlumno: boolean;
  /** Nombre del servicio (desnormalizado para display) */
  servicio: string;
  /** FK a service_catalog.id — null si el servicio fue eliminado definitivamente (fix-024-i) */
  servicioId: number | null;
  precio: number;
  /** Formato 'YYYY-MM-DD' */
  fecha: string;
  estado: 'completado' | 'pendiente';
  resultado: string | null;
  cobrado: boolean;
  /** `users.id` del alumno (vía `students.user_id`), null si es cliente externo */
  studentUserId: number | null;
  /** Sede de la venta — usado para el candado de borrado (fix-022-i) */
  branchId: number | null;
  /** N° de boleta emitida (opcional), migración 20260813070000 (fix-025-i). */
  documentNumber: string | null;
}

export interface VentaFormData {
  /** FK a service_catalog.id */
  servicioId: number;
  nombre: string;
  rut: string;
  esAlumno: boolean;
  fecha: string;
  precio: number;
  /** N° de boleta emitida (opcional) — se propaga a Caja Diaria (fix-025-i). */
  documentNumber?: string | null;
}

export interface NuevoServicioFormData {
  nombre: string;
  descripcion: string;
  precio: number;
}

export interface ServiciosEspecialesKpis {
  ventasMes: number;
  totalCobrado: number;
  recaudacionMes: number;
  pendientesCobro: number;
  totalRegistros: number;
  ventasCobradas: number;
  ventasSinCobrar: number;
}
