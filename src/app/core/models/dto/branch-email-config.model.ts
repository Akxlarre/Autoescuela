import type { Branch } from './branch.model';

/** Columnas de `branches` que definen a nombre de quién salen los correos de una escuela (spec 0061-b). */
export type BranchEmailConfigRow = Pick<
  Branch,
  'id' | 'name' | 'email_sender_name' | 'email_sender_address' | 'email' | 'phone'
>;
