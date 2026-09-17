// supabase/functions/_shared/template-tokens.ts
//
// Sustitución de placeholders {{clave}} sobre el texto editable de document_templates.
// El CÁLCULO de cada valor (monto, saldo, URL de política de privacidad, etc.) se queda en
// cada Edge Function — este módulo solo hace el reemplazo de texto, nunca decide qué calcular.

/**
 * Reemplaza cada `{{clave}}` presente en `text` por `tokens[clave]`. Una clave que aparece en el
 * texto pero no existe en `tokens` se sustituye por string vacío (nunca lanza) — así un admin que
 * borra o escribe mal un token no rompe la generación del documento (AC-E3): el peor caso es un
 * hueco en el texto, detectable en la Vista Previa obligatoria antes de publicar.
 */
export function substituteTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => tokens[key] ?? '');
}
