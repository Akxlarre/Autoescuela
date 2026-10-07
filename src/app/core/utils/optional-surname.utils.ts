/**
 * Apellido materno opcional (fix-204-b, S12 de ASG-i-034): vacío es válido (personas sin segundo
 * apellido, p. ej. extranjeros); si se escribe, al menos 2 caracteres, como el paterno.
 */
export function isOptionalSurnameValid(value: string | null | undefined): boolean {
  const v = (value ?? '').trim();
  return v.length === 0 || v.length >= 2;
}
