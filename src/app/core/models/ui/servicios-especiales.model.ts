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
  /** FK a service_catalog.id */
  servicioId: number;
  precio: number;
  /** Formato 'YYYY-MM-DD' */
  fecha: string;
  estado: 'completado' | 'pendiente';
  resultado: string | null;
  cobrado: boolean;
}

export interface VentaFormData {
  /** FK a service_catalog.id */
  servicioId: number;
  nombre: string;
  rut: string;
  esAlumno: boolean;
  fecha: string;
  precio: number;
  cobrado: boolean;
}

export interface NuevoServicioFormData {
  nombre: string;
  descripcion: string;
  precio: number;
}

export interface ServiciosEspecialesKpis {
  ventasMes: number;
  totalCobrado: number;
  pendientesCobro: number;
  totalRegistros: number;
  ventasCobradas: number;
  ventasSinCobrar: number;
}
