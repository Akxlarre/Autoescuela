# Fix: El código SENCE que escribe la secretaria en la matrícula no se guarda
> id: fix-061-i-codigo-sence-no-se-guarda
> refs: fix-058-i-testing-matricula-presencial (B3-4, sospecha S14)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

El paso 1 del wizard pide el código SENCE en un **campo de texto libre** (obligatorio en Clase B
SENCE), pero `enrollments` solo tiene `sence_code_id`, una FK al catálogo `sence_codes` (que solo
el admin puede editar y que ninguna pantalla mantiene). `savePersonalData()` traduce el texto a un
id con `_senceCodeMap`, que llena `loadSenceCodes()`, y esa función no tiene llamadores: el mapa
siempre está vacío y `sence_code_id` queda `null`. Al retomar el borrador, `resumeDraft()` arma
`senceCode: null` fijo, así que el campo vuelve vacío.

Datos (2026-10-22): 81 matrículas en cursos Clase B SENCE, 0 con código; 1 código en el catálogo,
sin uso. Son alumnos de prueba: no se recuperan códigos viejos.

Decisión (Ignacio, 2026-10-22): guardar el código tal como lo escribe la secretaria (opción A). El
catálogo `sence_codes` con desplegable queda como posible mejora aparte.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B3-4). Criterios de este fix:

- **AC-F1:** el código SENCE escrito en el paso 1 se guarda en la matrícula (sin espacios al
  borde) al crear el borrador y al actualizarlo.
- **AC-F2:** al retomar el borrador, el campo SENCE vuelve con el código guardado.
- **AC-F3:** en un curso que no es SENCE (o sin código), se guarda vacío (`null`).

## Cambio

- **Archivo:** `supabase/migrations/20261023120000_fix061i_enrollments_sence_code_texto.sql`
- **Qué cambia:** columna `enrollments.sence_code TEXT` (nullable).
- **Archivo:** `src/app/core/facades/enrollment.facade.ts`
- **Qué cambia:** `savePersonalData()` escribe `sence_code` con el texto (en vez de resolver
  `sence_code_id` por el mapa vacío); `resumeDraft()` lo devuelve a `personalData.senceCode`.
- **Archivo:** `src/app/core/models/dto/enrollment.model.ts` — campo `sence_code`.

## Test de Regresión

- `src/app/core/facades/enrollment.facade.spec.ts` (guardar y retomar el código SENCE).

## Progreso

- [x] Tests (rojo 4/6) + cambio en la facade (verde): `enrollment.facade.spec.ts` 102/102, `tsc`
      limpio (2026-10-23).
- [x] Migración aplicada por Ignacio (2026-10-23). ⚠️ Debe estar aplicada **antes** de publicar
      el front: sin la columna, crear o actualizar cualquier borrador falla.
- [x] QA en navegador.
- [x] Suite completa, `tsc`, `lint:arch` y cierre.

## Verificación

- 2026-10-23, QA Playwright como secretaria (sede 1), alumno `QA-061 Sence` (21.345.061-1), curso
  Clase B SENCE, código escrito como `"  9990610001 "`:
  - Crear borrador → POST con `sence_code: "9990610001"` (sin espacios), pasa al paso 2 ✅ (AC-F1).
  - Recargar y "Retomar" → el campo del paso 1 vuelve con `9990610001` ✅ (AC-F2).
  - Cambiar a `9990610002` y guardar → PATCH con el código nuevo ✅ (AC-F1, actualización).
  - Borrador descartado al terminar. Queda el alumno de prueba (student 8849), como en QA-058.
- `enrollment.facade.spec.ts` 102/102 (6 casos nuevos, incl. AC-F3 `null` sin código), suite
  completa 298 archivos, `tsc` limpio, `lint:arch` 0 errores. Consola del navegador sin errores.
- De paso: buscar "Descartar" por rol encuentra primero la tarjeta (es un botón cuyo nombre
  accesible incluye "Retomar Descartar") y al hacer clic **retoma** el borrador — es B4-1
  (botones anidados en la tarjeta), no un bug nuevo.
