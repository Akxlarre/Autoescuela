# Fix: Las tarjetas de borrador de matrícula son un botón con botones adentro
> id: fix-067-i-tarjetas-borrador-botones-anidados
> refs: fix-058-i-testing-matricula-presencial (B4-1)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

En `DraftListComponent` ("Matrículas en progreso") cada tarjeta es un `div` con `role="button"`,
`tabindex="0"`, `(click)` y `(keydown.enter)` que retoma el borrador, y adentro tiene los botones
"Retomar" y "Descartar". axe lo marca `nested-interactive` (serio, ×3 en `fix-058-i`): un lector de
pantalla anuncia la tarjeta entera como un botón cuyo nombre es todo su texto ("QA… Retomar
Descartar") y los botones de adentro quedan mal anunciados; con teclado hay dos paradas para la
misma acción. Efecto lateral: un clic en "Retomar" sube a la tarjeta y emite `resume` **dos
veces**; buscar el botón "Descartar" por rol encuentra primero la tarjeta y la retoma (visto en la
QA de `fix-061-i`).

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B4-1). Criterios de este fix:

- **AC-F1:** la tarjeta ya no es un control (sin `role="button"` ni `tabindex`); axe no reporta
  `nested-interactive` en la lista de borradores.
- **AC-F2:** "Retomar" emite `resume` una sola vez; "Descartar" emite solo `discard`.
- **AC-F3:** hacer clic en el cuerpo de la tarjeta (fuera de los botones) sigue retomando el
  borrador con el mouse.

## Cambio

- **Archivo:** `src/app/shared/components/matricula-steps/draft-list/draft-list.component.ts`
  (+ spec nuevo) — la tarjeta pierde `role`/`tabindex`/`keydown`; su clic ignora los que vienen de
  un botón.

## Test de Regresión

- `draft-list.component.spec.ts` (nuevo): tarjeta sin rol, un solo `resume` por clic, descartar
  sin retomar, clic en el cuerpo retoma.

## Progreso

- [x] Tests (rojo 3/3) + componente (verde): `draft-list.component.spec.ts` 3/3.
- [x] axe en navegador sobre la lista de borradores.
- [x] Suite completa, `tsc`, `lint:arch` y cierre.

## Verificación

- 2026-10-23, Playwright como secretaria (sede 1), borrador de prueba `QA Tarjeta Sesentaisiete`:
  - axe (wcag2a, wcag2aa, best-practice) sobre `app-draft-list`: **sin `nested-interactive`** ✅
    (AC-F1). Queda `color-contrast` ×2 (textos grises), que es el tema de ASG-i-065 / 0054-b.
  - "Retomar" → una sola reanudación (1 PATCH de vencimiento) y el wizard abre en el paso 2 ✅.
  - "Descartar" → abre la confirmación sin retomar; confirmado, el borrador desaparece ✅ (AC-F2).
  - Consola sin errores.
- AC-F3 (clic en el cuerpo retoma) cubierto por `draft-list.component.spec.ts`. El spec no
  renderiza (Vitest del proyecto no compila plantillas): prueba `onCardClick()` sobre la clase y
  revisa en el código fuente que la tarjeta no tenga `role`/`tabindex`.
- Suite completa 299 archivos, `tsc` limpio, `lint:arch` 0 errores.
