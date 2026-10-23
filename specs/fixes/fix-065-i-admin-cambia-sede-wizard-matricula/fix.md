# Fix: Si el admin cambia de sede con el wizard de matrícula abierto, queda una mezcla de las dos sedes
> id: fix-065-i-admin-cambia-sede-wizard-matricula
> refs: fix-058-i-testing-matricula-presencial (B2-3, sospecha S21)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

En `SecretariaMatriculaComponent`, el `effect()` que reacciona al cambio de sede del topbar (solo
admin) con el wizard abierto **solo** vacía el formulario del paso 1 y recarga los cursos de la sede
nueva. No toca el borrador ni el paso: confirmado en `fix-058-i` — en el paso 3, sede 1 → 2, el
wizard siguió en el paso 3 con el borrador de la sede 1, el paso 1 vacío y los cursos de la sede 2
(apareció Profesional), sin aviso. Guardar desde ahí mezcla datos de las dos sedes.

Además el efecto lee `currentUser()`: si ese signal se re-emite (refresco de sesión) con la misma
sede, el formulario del paso 1 se vacía igual.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B2-3). Criterios de este fix:

- **AC-F1:** si el admin cambia de sede con el wizard abierto, el wizard vuelve a empezar en la
  sede nueva (lista de borradores de esa sede, o matrícula nueva si no hay).
- **AC-F2:** si ya había un borrador guardado, no se pierde: queda como borrador en la sede
  anterior y aparece un aviso que lo dice.
- **AC-F3:** si la sede no cambió de verdad (el efecto se re-dispara con la misma sede), no pasa
  nada.

## Cambio

- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` (+ spec) —
  recuerda la sede con que arrancó el wizard; ante un cambio real reinicia el wizard
  (`initWizard()`), avisando si había un borrador guardado.

## Test de Regresión

- `secretaria-matricula.component.spec.ts` (cambio de sede con y sin borrador; misma sede).

## Progreso

- [x] Tests (rojo 2/3) + componente (verde): `secretaria-matricula.component.spec.ts` 26/26.
- [x] QA en navegador como admin.
- [x] Suite completa, `tsc`, `lint:arch` y cierre.

## Verificación

- 2026-10-23, QA Playwright como admin, wizard abierto como panel desde Alumnos:
  - Sede 1 (Autoescuela Chillán) en la pantalla de selección → borrador 8575 `QA Sede
    Sesentaicinco` guardado, wizard en el paso 2.
  - Cambio de sede a Conductores Chillán (mismo método que el selector del topbar) → toast
    "Matrícula guardada como borrador · La matrícula en curso quedó como borrador en Autoescuela
    Chillán. La encuentras al volver a esa sede."; el wizard volvió al paso 1, limpio, en la sede 2;
    en la BD el 8575 sigue `draft` con `branch_id = 1` ✅ (AC-F1, AC-F2).
  - Volver a la sede 1 → lista de borradores con el 8575, sin aviso ✅. Borrador descartado al
    terminar. Consola sin errores.
- AC-F3 (misma sede re-emitida no reinicia) cubierto por `secretaria-matricula.component.spec.ts`.
- Suite completa 298 archivos, `tsc` limpio, `lint:arch` 0 errores.
