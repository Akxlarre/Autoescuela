# Fix: Campo obligatorio de código SENCE al matricular en Clase B SENCE
> id: fix-241-m-sence-code-input-matricula
> refs: —
> status: in_progress
> created: 2026-09-07

## Root Cause
El wizard de matrícula (`personal-data.component.ts`, paso 1, compartido por Secretaria y
Admin vía `admin-matricula.component.ts` → `SecretariaMatriculaComponent`) permite seleccionar
el curso "Clase B SENCE" (`courseType === 'class_b_sence'`), pero nunca captura el código SENCE
asociado. El modelo de formulario ya trae el campo `senceCode: string | null`
(`enrollment-personal-data.model.ts`) y `enrollment.facade.ts` ya intenta resolverlo a
`sence_code_id` al crear el enrollment (líneas ~678-681), pero como ningún input del wizard
lo setea, `senceCode` queda siempre en `null` y el enrollment se crea sin código SENCE
vinculado, sin ningún error visible para quien matricula.

Nota de alcance (decisión explícita del dueño): NO se implementa un selector validado contra
la tabla `sence_codes` (esa infraestructura — `loadSenceCodes()`, signal `senceOptions`,
`_senceCodeMap` en `enrollment.facade.ts` — existe pero se deja sin usar). Se usa un input de
texto libre porque el caso de uso es poco frecuente y las reglas de negocio de los códigos
SENCE no están bien entendidas por el equipo todavía.

## ACs Afectados
Ninguno — fix autónomo (no viene de una spec previa).

- AC-1: Al seleccionar un curso con `courseType === 'class_b_sence'` en el paso 1 del wizard,
  aparece un campo de texto (`senceCode`) etiquetado como "Código SENCE".
- AC-2: El campo es obligatorio solo cuando `courseType === 'class_b_sence'` — no bloquea el
  avance para `class_b` ni `class_b_reinforcement` ni ningún otro curso.
- AC-3: El wizard no permite avanzar al paso siguiente si `courseType === 'class_b_sence'` y
  `senceCode` está vacío.
- AC-4: El valor ingresado se persiste tal cual en `senceCode` del form model y llega a
  `enrollment.facade.ts` sin transformación (texto libre, no se valida contra `sence_codes`).
- AC-5: Funciona igual en Secretaria y en Admin (mismo componente compartido).

## Cambio
- **Archivo:** `src/app/shared/components/matricula-steps/personal-data/personal-data.component.html`
  **Qué cambia:** agrega un `<input>` de texto para `senceCode`, visible solo cuando
  `data().courseType === 'class_b_sence'`.
- **Archivo:** `src/app/shared/components/matricula-steps/personal-data/personal-data.component.ts`
  **Qué cambia:** agrega validación de que `senceCode` no esté vacío cuando el curso
  seleccionado es `class_b_sence`, bloqueando el `canAdvance`/equivalente del paso.

## Test de Regresión
- `personal-data.component.spec.ts > requiere senceCode cuando courseType es class_b_sence y no bloquea otros cursos` ✓
