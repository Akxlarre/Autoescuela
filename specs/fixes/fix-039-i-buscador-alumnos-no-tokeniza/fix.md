# Fix: Buscador de listados de alumnos no tokeniza "nombre + apellido"

> id: fix-039-i-buscador-alumnos-no-tokeniza
> refs: fix-037-i-qa-visual-piloto
> status: draft
> created: 2026-09-22

## Root Cause

`filteredAlumnos` en `alumnos-list-content.component.ts:743-749` (y el mismo patrón copiado
en 6 archivos más) busca así:

```ts
const matchSearch =
  !term ||
  a.nombre.toLowerCase().includes(term) ||
  a.apellido.toLowerCase().includes(term) ||
  a.rut.includes(term) ||
  a.nroExpedientes.some((n) => n.toLowerCase().includes(term));
```

Cada campo se compara contra el término de búsqueda **completo**, por separado. Si el
usuario escribe "Camila Reyes" (nombre + apellido, el orden natural en que cualquiera
buscaría), ni `nombre` ("Camila Andrea") ni `apellido` ("Reyes Muñoz") contienen la frase
completa de 2 palabras → 0 resultados, aunque el alumno exista. Buscar solo "Camila" o solo
"Reyes" sí funciona.

Encontrado durante `fix-037-i-qa-visual-piloto` (QA del piloto): al buscar a la alumna recién
creada "Camila Reyes" en Base Alumnos B, el listado devolvió "No se encontraron alumnos".

## ACs Afectados

Ninguno — fix autónomo, hallazgo de QA sin spec previa.

- AC-1: buscar "Camila Reyes" (o cualquier combinación nombre+apellido en cualquier orden)
  encuentra al alumno "Reyes Muñoz Camila Andrea" en Base Alumnos B.
- AC-2: el mismo comportamiento aplica en los 7 listados afectados: Base Alumnos B, Base
  Alumnos Profesional, Ex-Alumnos B, Ex-Alumnos Profesional, Secretarias, Relatores,
  comentarios de ex-alumnos.
- AC-3: búsquedas de un solo término (solo nombre, solo apellido, solo RUT) siguen
  funcionando igual que antes — no debe haber regresión.

## Cambio

- **`core/utils/`** — nueva función pura `matchesSearchTokens(term: string, ...fields:
  string[]): boolean` que:
  1. Tokeniza `term` por espacios (trim + split).
  2. Para cada token, exige que matchee (substring, case-insensitive) en AL MENOS uno de los
     `fields` recibidos — no que el término completo esté en un único campo.
  3. Si `term` está vacío, retorna `true` (sin filtro).
- Reemplazar la condición duplicada en los 7 archivos por una llamada a esta utilidad:
  `alumnos-list-content.component.ts`, `alumnos-profesional-list-content.component.ts`,
  `ex-alumnos-content.component.ts`, `ex-alumnos-profesional-content.component.ts`,
  `admin-secretarias.component.ts`, `admin-profesional-relatores.component.ts`,
  `admin-ex-alumnos-comentarios-drawer.component.ts`.
- Fuera de alcance: no se toca el buscador global (Ctrl+K) ni ningún filtro server-side —
  solo los `computed()` client-side que ya existían con este patrón.

## Test de Regresión

- Nuevo `matches-search-tokens.utils.spec.ts` en `core/utils/`: casos con 1 token, 2+ tokens
  en cualquier orden repartidos entre 2 campos, término vacío, término que no matchea nada,
  mayúsculas/minúsculas mezcladas.
- Actualizar los specs existentes de los 7 componentes si tenían un test de búsqueda
  específico, para usar la nueva utilidad.
- `npm run test:ci` completo debe quedar verde.

## Evidencia de Verificación

- **2026-09-22, QA de `fix-037-i-qa-visual-piloto` (Bloque C, recorrido Secretarias):** probé
  `admin-secretarias.component.ts` buscando "Lola SECRETARIA" (nombre + parte del apellido de
  "Lola SECRETARIA MENTO") — **sí encontró el resultado**, a diferencia del síntoma reproducido
  en Base Alumnos B. Causa probable: en este componente el campo de búsqueda parece comparar
  contra un `nombre` ya concatenado (nombre completo en un solo string), no contra `nombre` y
  `apellido` por separado como en `alumnos-list-content.component.ts` — por lo que el substring
  "Lola SECRETARIA" sí matchea dentro de "Lola SECRETARIA MENTO". **Antes de tocar este
  archivo**, verificar en código si realmente comparte el patrón bugueado o si ya concatena
  campos (en cuyo caso no necesita el fix, o necesita uno menor). No cambia el diagnóstico para
  `alumnos-list-content.component.ts` (reproducido con evidencia clara), pero el alcance de "7
  archivos afectados" debe confirmarse archivo por archivo antes de aplicar la utilidad
  compartida a todos.
