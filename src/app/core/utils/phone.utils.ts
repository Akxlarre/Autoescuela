export interface DialCode {
  countryCode: string;
  dialCode: string;
  flag: string;
  label: string;
  placeholder: string;
}

export const DIAL_CODES: DialCode[] = [
  { countryCode: 'CL', dialCode: '+56', flag: '🇨🇱', label: 'Chile', placeholder: '9 1234 5678' },
  {
    countryCode: 'AR',
    dialCode: '+54',
    flag: '🇦🇷',
    label: 'Argentina',
    placeholder: '11 1234 5678',
  },
  { countryCode: 'PE', dialCode: '+51', flag: '🇵🇪', label: 'Perú', placeholder: '912 345 678' },
  { countryCode: 'BO', dialCode: '+591', flag: '🇧🇴', label: 'Bolivia', placeholder: '7123 4567' },
  {
    countryCode: 'CO',
    dialCode: '+57',
    flag: '🇨🇴',
    label: 'Colombia',
    placeholder: '312 345 6789',
  },
  {
    countryCode: 'VE',
    dialCode: '+58',
    flag: '🇻🇪',
    label: 'Venezuela',
    placeholder: '412 123 4567',
  },
  { countryCode: 'ES', dialCode: '+34', flag: '🇪🇸', label: 'España', placeholder: '612 345 678' },
  {
    countryCode: 'US',
    dialCode: '+1',
    flag: '🇺🇸',
    label: 'EE.UU. / Canadá',
    placeholder: '(555) 123-4567',
  },
  { countryCode: 'OTHER', dialCode: '', flag: '🌐', label: 'Otro', placeholder: '0000 0000' },
];

function digitsOnly(str: string): string {
  return str.replace(/\D/g, '');
}

/**
 * Validates a phone number given raw subscriber digits and a dial code.
 *
 * Chile (+56): exactly 8 digits (landline) OR exactly 9 digits starting with '9' (mobile).
 * Other countries: 7–15 digits (E.164 subscriber number range).
 * Spaces in `digits` are ignored before validation.
 */
export function validatePhone(digits: string, dialCode: string): boolean {
  const stripped = digitsOnly(digits);
  if (!stripped) return false;

  if (dialCode === '+56') {
    if (stripped.length === 8) return true;
    if (stripped.length === 9 && stripped[0] === '9') return true;
    return false;
  }

  return stripped.length >= 7 && stripped.length <= 15;
}

/**
 * Returns the E.164 representation: dialCode + subscriber digits (spaces stripped).
 * Example: normalizePhone('9 1234 5678', '+56') → '+56912345678'
 */
export function normalizePhone(digits: string, dialCode: string): string {
  return dialCode + digitsOnly(digits);
}
