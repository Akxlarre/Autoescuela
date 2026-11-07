/**
 * fix-500-m: solo URLs http(s). Lo que la secretaria escribe en Configuración web va a un
 * `href` o al `src` de un iframe: un "javascript:" ahí se ejecuta en la página pública.
 * La hidratación de LandingLayout.astro repite esta regla (script inline, no puede importar).
 */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  const v = String(url ?? '').trim();
  return /^https?:\/\/\S+$/i.test(v) ? v : undefined;
}
