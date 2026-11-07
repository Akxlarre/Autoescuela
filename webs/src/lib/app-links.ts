/**
 * Enlaces de la landing hacia la app (hotfix-174-m).
 *
 * Dominio de la app: docs/DEPLOY.md (APP_DOMAIN). Si cambia, cambia acá.
 */
export const APP_BASE_URL = 'https://app.gestordeautoescuelas.cl';

/** `branches.slug` de cada sede: es el parámetro de la ruta pública de la política. */
const POLICY_SLUG_BY_BRANCH: Record<number, string> = {
  1: 'autoescuela-chillan',
  2: 'conductores-chillan',
};

/** URL de la política de privacidad de la sede, o undefined si la sede no tiene. */
export function privacyPolicyUrl(branchId: number): string | undefined {
  const slug = POLICY_SLUG_BY_BRANCH[branchId];
  return slug ? `${APP_BASE_URL}/politica-privacidad/${slug}` : undefined;
}
