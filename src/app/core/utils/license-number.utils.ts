/**
 * Número de licencia del instructor (fix-211-b, S20 de ASG-i-034): obligatorio al crear y al
 * editar (decisión del owner). Válido = al menos 3 caracteres sin contar espacios a los lados.
 */
export function isValidLicenseNumber(value: string | null | undefined): boolean {
  return (value ?? '').trim().length >= 3;
}
