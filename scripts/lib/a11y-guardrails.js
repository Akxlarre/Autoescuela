/**
 * a11y-guardrails.js — Primer guardrail de accesibilidad del proyecto (fix-079-b / ASG-b-054).
 *
 * Hasta este track había 8 reglas ARCH vigilando higiene de color/clases y CERO vigilando
 * accesibilidad — la deuda de a11y se estimaba de oído ("2 archivos conocidos") en vez de
 * medirse. Auditoría real: 94 botones icon-only sin nombre accesible en 41 archivos (92 tras
 * descartar 2 falsos positivos con `pButton label="..."`, que ya tienen nombre vía PrimeNG),
 * más **2 adicionales** que el heurístico inicial no vio (ver nota de `stripControlFlow`
 * abajo) — total real: 94 instancias, 92+2, todas resueltas en este mismo track.
 *
 *   ARCH-20  findIconOnlyButtonsWithoutLabel — <button> con <app-icon>, sin texto visible,
 *            sin aria-label, sin [title] ni pButton label="..." → sin nombre accesible.
 *
 * A diferencia de ARCH-15/16/17 (ratchets con backlog pre-existente), ARCH-20 arranca en
 * CERO y es ERROR duro desde el día uno — no hay backlog legítimo que tolerar en a11y.
 *
 * Micro-suite: `node scripts/lib/a11y-guardrails.test.mjs`
 */

const BUTTON_RE = /<button\b[^>]*>[\s\S]*?<\/button>/g;

/**
 * Quita la sintaxis de control de flujo de Angular (`@if(...) { }@else{ }`, `@switch`,
 * `@for`) dejando su CONTENIDO intacto, para que el chequeo de "texto visible" de abajo
 * no confunda `@if (cond) {` con texto real.
 *
 * Bug real encontrado en vivo (fix-079-b): la primera versión de este detector (y del
 * script de auditoría que generó el inventario de 94) usaba `[^)]*` para la condición del
 * `@if`, que se rompe con condiciones que tienen SUS PROPIOS paréntesis anidados — ej.
 * `@if (isGeneratingFicha() === alumno.enrollmentId) {`. `[^)]*` para en el PRIMER `)` que
 * encuentra (el de `isGeneratingFicha()`), nunca llega al que cierra la condición completa,
 * así que el regex no matchea nada y el `@if(...) {` entero queda como "texto visible" →
 * 2 botones reales (`alumnos-list-content.component.ts:480,630`, ícono de exportar/loading
 * alternado por `@if/@else`) se colaron sin `aria-label` a través del audit original.
 *
 * Fix: `.*` GREEDY (no `[^)]*`) — al no excluir `)`, backtrackea hasta encontrar el ÚLTIMO
 * `)` seguido de `{` en la misma línea, que es el cierre real de la condición sin importar
 * cuántos paréntesis anidados tenga. `.` no cruza líneas, así que asume condición+llave en
 * una sola línea — cierto en este codebase porque Prettier lo formatea así.
 */
function stripControlFlowSyntax(block) {
  return block
    .replace(/@if\s*\(.*\)\s*\{/g, '')
    .replace(/@else\s+if\s*\(.*\)\s*\{/g, '')
    .replace(/@else\s*\{/g, '')
    .replace(/@switch\s*\(.*\)\s*\{/g, '')
    .replace(/@case\s*\(.*\)\s*:?\s*\{?/g, '')
    .replace(/@default\s*:?\s*\{?/g, '')
    .replace(/@for\s*\(.*\)\s*\{/g, '')
    .replace(/^\s*\}\s*$/gm, '');
}

export function findIconOnlyButtonsWithoutLabel(content) {
  const hits = [];
  let m;
  BUTTON_RE.lastIndex = 0;
  while ((m = BUTTON_RE.exec(content)) !== null) {
    const block = m[0];

    if (!/<app-icon\b/.test(block)) continue;
    if (/aria-label/.test(block)) continue;
    if (/\[title\]=/.test(block)) continue;
    if (/(?<!\[)title="[^"]+"/.test(block)) continue;
    // pButton label="..." — PrimeNG renderiza el texto como hijo del botón, no
    // aparece entre los tags del template estático, así que hay que excluirlo
    // explícitamente (fue un falso positivo real del heurístico inicial).
    if (/\blabel="[^"]+"/.test(block)) continue;

    const stripped = stripControlFlowSyntax(block)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, 'X');
    if (stripped.split(' ').join('').trim().length > 0) continue;

    const icon =
      block.match(/<app-icon\s+name="([^"]+)"/)?.[1] ??
      (/<app-icon\s+\[name\]=/.test(block) ? '(dinámico)' : '?');
    hits.push(icon);
  }
  return hits;
}
