/** UI model para un alumno con saldo pendiente en la vista de Gestión de Pagos. */
export interface AlumnoDeudor {
  enrollmentId: number;
  /** Nombre completo: first_names + paternal_last_name */
  alumno: string;
  rut: string;
  /** base_price - discount */
  totalAPagar: number;
  pagado: number;
  saldo: number;
}
