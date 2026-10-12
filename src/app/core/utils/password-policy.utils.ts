/**
 * Regla de contraseñas de la app (spec 0050-b). Fuente ÚNICA: las dos pantallas donde se fija una
 * contraseña (crear/recuperar y Ajustes → Cambiar contraseña) evalúan con esta función.
 *
 * Debe coincidir con la configuración de Supabase Auth del proyecto (`password_min_length = 10`,
 * letras y dígitos obligatorios): si la app pidiera menos, la persona escribiría una clave que el
 * servidor rechaza.
 */
export const PASSWORD_MIN_LENGTH = 10;

/** Largo mínimo de un dato propio para que cuente (evita que "Ana" bloquee "banana"). */
const MIN_PERSONAL_TOKEN = 4;
/** Desde este largo la clave suma un nivel de fortaleza. */
const LONG_PASSWORD = 14;

/** Datos de la persona que no deben aparecer dentro de su contraseña. */
export interface PasswordContext {
  name?: string | null;
  email?: string | null;
  rut?: string | null;
}

export type PasswordRequirementId = 'length' | 'letter' | 'digit' | 'not-personal';

export interface PasswordRequirement {
  id: PasswordRequirementId;
  label: string;
  met: boolean;
}

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordEvaluation {
  /** Siempre los 4 requisitos, en el mismo orden. */
  requirements: PasswordRequirement[];
  /** Todos los requisitos cumplidos: la clave se puede guardar. */
  valid: boolean;
  /** Orientativa: no bloquea. */
  strength: PasswordStrength;
}

/** Minúsculas y sin tildes, para comparar sin distinguirlas. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Fragmentos de los datos de la persona que no pueden aparecer en la clave. */
function personalTokens(ctx: PasswordContext): string[] {
  const tokens: string[] = [];
  for (const word of normalize(ctx.name ?? '').split(/[^\p{L}]+/u)) tokens.push(word);
  tokens.push(normalize(ctx.email ?? '').split('@')[0]);
  // Cuerpo del RUT: sin puntos ni dígito verificador.
  tokens.push((ctx.rut ?? '').split('-')[0].replace(/\D/g, ''));
  return tokens.filter((t) => t.length >= MIN_PERSONAL_TOKEN);
}

function characterClasses(password: string): number {
  return [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d]/u].filter((re) => re.test(password)).length;
}

export function evaluatePassword(password: string, ctx: PasswordContext = {}): PasswordEvaluation {
  const normalized = normalize(password);
  const withoutDots = normalized.replace(/\./g, '');
  const containsPersonal = personalTokens(ctx).some(
    (token) => normalized.includes(token) || withoutDots.includes(token),
  );

  const requirements: PasswordRequirement[] = [
    {
      id: 'length',
      label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    { id: 'letter', label: 'Al menos una letra', met: /\p{L}/u.test(password) },
    { id: 'digit', label: 'Al menos un número', met: /\d/.test(password) },
    {
      id: 'not-personal',
      label: 'Sin tu nombre, correo ni RUT',
      // Vacía queda pendiente: no se marca cumplido algo que todavía no se pudo evaluar.
      met: password.length > 0 && !containsPersonal,
    },
  ];
  const valid = requirements.every((r) => r.met);

  let strength: PasswordStrength = 'weak';
  if (password.length === 0) {
    strength = 'empty';
  } else if (valid) {
    const extras =
      Number(password.length >= LONG_PASSWORD) + Number(characterClasses(password) >= 3);
    strength = extras === 2 ? 'strong' : extras === 1 ? 'good' : 'fair';
  }

  return { requirements, valid, strength };
}

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'Débil',
  fair: 'Aceptable',
  good: 'Buena',
  strong: 'Muy buena',
};

export function passwordStrengthLabel(strength: PasswordStrength): string {
  return STRENGTH_LABELS[strength];
}
