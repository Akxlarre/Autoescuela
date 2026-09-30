/**
 * Se ejecuta una vez, antes de cualquier test (spec 0019-m).
 * Si algo falla aquí, Playwright no corre ningún test.
 */
import { environment } from '../src/environments/environment';
import { ALLOWED_SUPABASE_REFS, assertDevSupabase } from './support/env-guard';
import { KNOWN_ERRORS, validateKnownErrors } from './support/known-errors';

export default function globalSetup(): void {
  assertDevSupabase(environment.supabase.url, ALLOWED_SUPABASE_REFS); // AC3
  validateKnownErrors(KNOWN_ERRORS); // AC8
}
