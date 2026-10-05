// supabase/functions/_shared/contract-email.ts
//
// Contenido del correo que le lleva al alumno su contrato de matrícula firmado (fix-318-m).
// Funciones puras, sin I/O: el envío vive en send-enrollment-contract-email/index.ts.

/** Colores de marca por tema de sede (mismos valores que activate-student-account). */
export const CONTRACT_EMAIL_THEMES = {
  azul: {
    brandColor: '#0ea5e9',
    brandColorDark: '#0369a1',
    brandColorLight: '#f0f9ff',
    gradientHero: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%)',
  },
  roja: {
    brandColor: '#fd2018',
    brandColorDark: '#bc0b05',
    brandColorLight: '#fff1f0',
    gradientHero: 'linear-gradient(160deg, #bc0b05 0%, #fd2018 55%, #f97316 100%)',
  },
} as const;

export type ContractEmailTheme = (typeof CONTRACT_EMAIL_THEMES)[keyof typeof CONTRACT_EMAIL_THEMES];

/** Tema de la sede, o el azul si la sede no tiene uno configurado o trae un valor desconocido. */
export function resolveContractEmailTheme(theme: string | null | undefined): ContractEmailTheme {
  return (
    CONTRACT_EMAIL_THEMES[theme as keyof typeof CONTRACT_EMAIL_THEMES] ?? CONTRACT_EMAIL_THEMES.azul
  );
}

export interface ContractEmailData {
  studentName: string;
  schoolName: string;
  courseName: string;
  /** Nº de matrícula, o null si la matrícula aún no tiene uno. */
  enrollmentNumber: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Iniciales de la escuela para el sello del encabezado ("Conductores Chillán" → "CC"). */
export function schoolInitials(schoolName: string): string {
  return schoolName
    .split(' ')
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function contractEmailSubject(data: ContractEmailData): string {
  const numero = data.enrollmentNumber ? ` Nº ${data.enrollmentNumber}` : '';
  return `Tu contrato de matrícula${numero} — ${data.schoolName}`;
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/**
 * Nombre y tipo del adjunto a partir de la ruta guardada en `digital_contracts.file_url`
 * (`contracts/<id>/contract.<ext>`). El wizard acepta el contrato escaneado en PDF, JPG o PNG.
 * Devuelve null si la extensión no es una de esas: no se adjunta un archivo de tipo desconocido.
 */
export function contractAttachment(
  storagePath: string,
  enrollmentNumber: string | null,
): { filename: string; contentType: string } | null {
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return null;
  const sufijo = enrollmentNumber ? `_${enrollmentNumber.replace(/[^A-Za-z0-9-]/g, '')}` : '';
  return { filename: `Contrato_Matricula${sufijo}.${ext}`, contentType };
}

export function buildContractEmailHtml(data: ContractEmailData, theme: ContractEmailTheme): string {
  const student = escapeHtml(data.studentName);
  const school = escapeHtml(data.schoolName);
  const course = escapeHtml(data.courseName);
  const initials = escapeHtml(schoolInitials(data.schoolName));
  const numero = data.enrollmentNumber
    ? `<tr><td style="padding:10px 16px;color:#64748b;font-size:14px;">Nº de matrícula</td><td style="padding:10px 16px;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(data.enrollmentNumber)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu contrato de matrícula - ${school}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;">
<div style="max-width:600px;margin:24px auto;background-color:#ffffff;border-radius:16px;overflow:hidden;">

  <div style="padding:40px 36px;text-align:center;background-color:${theme.brandColor};background:${theme.gradientHero};">
    <div style="display:inline-block;width:60px;height:60px;line-height:60px;border-radius:14px;border:2px solid rgba(255,255,255,0.3);background-color:rgba(255,255,255,0.15);color:#ffffff;font-size:22px;font-weight:800;">${initials}</div>
    <p style="margin:14px 0 0;color:rgba(255,255,255,0.9);font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${school}</p>
  </div>

  <div style="padding:40px 36px 32px;">
    <p style="margin:0 0 10px;color:${theme.brandColor};font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Matrícula confirmada</p>
    <h1 style="margin:0 0 14px;color:#0f172a;font-size:28px;font-weight:800;line-height:1.2;">Hola, ${student}</h1>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
      Tu matrícula quedó confirmada. Adjunto a este correo va una copia de tu contrato firmado.
      Guárdala: es tu respaldo de lo acordado con la escuela.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:12px;background-color:#f8fafc;">
      <tr><td style="padding:10px 16px;color:#64748b;font-size:14px;">Curso</td><td style="padding:10px 16px;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${course}</td></tr>
      ${numero}
    </table>

    <div style="margin-top:24px;padding:16px 18px;border-radius:10px;background-color:${theme.brandColorLight};">
      <p style="margin:0;color:${theme.brandColorDark};font-size:14px;">
        Si algo del contrato no coincide con lo que conversaste en la escuela, avísanos en
        secretaría para corregirlo.
      </p>
    </div>
  </div>

  <div style="padding:24px 36px;text-align:center;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
    <p style="margin:0 0 6px;color:#334155;font-size:14px;font-weight:700;">${school}</p>
    <p style="margin:0;color:#94a3b8;font-size:12px;">
      Este correo se envió automáticamente al confirmar tu matrícula. Por favor no lo respondas.
    </p>
  </div>

</div>
</body>
</html>`;
}
