# Fix: Buscador de listados de alumnos no tokeniza "nombre + apellido"

> id: fix-039-i-buscador-alumnos-no-tokeniza
> refs: fix-037-i-qa-visual-piloto, ASG-i-015
> status: done
> created: 2026-09-22
> activated: 2026-09-24
> closed: 2026-09-24

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

- **2026-09-24, verificación archivo por archivo (ASG-i-015, previa a implementar):**
  confirmado con lectura directa de código, no solo grep:
  - `alumnos-list-content.component.ts` y `alumnos-profesional-list-content.component.ts`:
    campos `nombre`/`apellido` separados → reproduce el bug tal cual el Root Cause. Ambos ya
    buscan por N° de matrícula (`nroExpedientes` / `nroMatricula` respectivamente) — sin
    trabajo adicional en ese frente, solo aplican `matchesSearchTokens`.
  - `ex-alumnos-content.component.ts` y `ex-alumnos-profesional-content.component.ts`: el
    campo `nombre` de `EgresadoTableRow` ya viene concatenado ("Nombre completo para
    mostrar"), no separado en nombre/apellido — el síntoma del Root Cause (0 resultados con
    2 tokens repartidos) no aplica igual porque `.includes(term)` sobre un string ya
    combinado matchea si el orden coincide, pero SÍ falla si el usuario invierte el orden
    ("Reyes Camila" en vez de "Camila Reyes"). Se benefician de `matchesSearchTokens` para
    ese caso. Ambos ya buscan por `nroExpediente` (N° de matrícula) — sin trabajo adicional
    ahí.
  - `admin-secretarias.component.ts`, `admin-profesional-relatores.component.ts`,
    `admin-ex-alumnos-comentarios-drawer.component.ts`: mismo caso de `nombre` concatenado
    (sin split), y **ninguno de los 3 tiene concepto de N° de matrícula** — secretarias y
    relatores no tienen `enrollments`, y el drawer de comentarios busca por texto de opinión,
    no por alumno. Se les aplica igual `matchesSearchTokens` sobre `nombre` (beneficio:
    orden invertido), pero no se agrega ninguna columna de matrícula porque no existe el dato
    para ese dominio.
  - **Conclusión de alcance:** los 7 archivos reciben `matchesSearchTokens`. La búsqueda por
    N° de matrícula que pedía el usuario en paralelo ya estaba cubierta en los 4 archivos
    donde aplica (alumnos/ex-alumnos B y Profesional) — no requiere cambio de código, solo se
    confirma y se documenta acá.

  - **Corrección durante implementación:** `admin-ex-alumnos-comentarios-drawer.component.ts`
    se revirtió a su comparación original (`||` de 3 substrings independientes: nombre, texto
    del comentario, rating) tras romper 2 tests existentes. Causa: al combinar `nombre` +
    `texto` + `rating` en un solo haystack tokenizado, un token numérico corto (ej. "3") pasaba
    a matchear como substring dentro de OTRO registro no relacionado (ej. "13" contiene "3"),
    devolviendo falsos positivos cruzados entre campos de distinta naturaleza (nombre propio
    vs texto libre vs rating numérico) que el comportamiento anterior no producía. Este archivo
    ya estaba marcado como "beneficio menor" en el análisis de alcance (nombre es un único
    campo, sin el bug real de nombre/apellido separados) — no se justifica forzar la
    tokenización acá a costa de romper el contrato de búsqueda existente. AC-2 para este
    archivo específico queda sin aplicar; el resto (6 de 7) sí la recibió.

  - `npm run test:ci`: 2670/2670 verdes (5 skipped, sin relación), incluyendo los 25 tests
    nuevos de `matchesSearchTokens`/`filterBySearchTokens` en `search-filter.utils.spec.ts`.
    `tsc --noEmit` limpio.
  - **AC-1 verificado en vivo con Playwright** contra `ng serve`: en `/app/admin/alumnos`,
    buscar "Camila Reyes" devuelve exactamente 1 resultado ("Reyes Muñoz Camila Andrea", de
    129 alumnos totales) — antes del fix este mismo término devolvía "No se encontraron
    alumnos" según el QA original.
  - **AC-2 verificado por lectura de código** (no requiere QA visual repetido por archivo,
    ya que `matchesSearchTokens` tiene cobertura unitaria completa y cada componente solo
    cambió la llamada de filtro, no la lógica de UI): aplicado en
    `alumnos-list-content.component.ts`, `alumnos-profesional-list-content.component.ts`,
    `ex-alumnos-content.component.ts`, `ex-alumnos-profesional-content.component.ts`,
    `admin-secretarias.component.ts`, `admin-profesional-relatores.component.ts`. Excluido
    `admin-ex-alumnos-comentarios-drawer.component.ts` (ver nota de corrección arriba).
  - **AC-3:** cubierto por los tests de `matchesSearchTokens` (`'sigue funcionando con un solo
    término'`) y por el suite completo en verde — sin regresión en búsquedas de 1 término.
