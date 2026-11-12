// supabase/functions/_shared/school-theme.ts
//
// Colores de una escuela para sus correos (spec 0061-b): `website_config.config.brand.theme`, el
// mismo origen que usan el contrato, el certificado y el Zoom. Lo usan los comunicados y las
// invitaciones de personal, que antes salían siempre en azul.

import { resolveContractEmailTheme, type ContractEmailTheme } from './contract-email.ts';

/**
 * Tema de la escuela, o el azul si no tiene uno o si la lectura falla: el color no justifica
 * cortar un envío.
 */
export async function loadSchoolTheme(
  // deno-lint-ignore no-explicit-any
  service: any,
  branchId: number | null | undefined,
): Promise<ContractEmailTheme> {
  if (branchId === null || branchId === undefined) return resolveContractEmailTheme(null);
  const { data, error } = await service
    .from('website_config')
    .select('config')
    .eq('branch_id', branchId)
    .maybeSingle();
  if (error) console.error('loadSchoolTheme: no se pudo leer website_config', error);
  return resolveContractEmailTheme(error ? null : data?.config?.brand?.theme);
}
