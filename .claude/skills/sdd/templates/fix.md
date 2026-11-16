# Fix: {TÍTULO}
> id: {ID}
> refs: (spec relacionada, ej: 0001-sistema-de-tareas-multi-rol, o "—" si es independiente)
> status: in_progress
> created: {FECHA_HOY}

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
...

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
<!-- Si el fix es independiente de cualquier spec, escribir "Ninguno — fix autónomo". -->
- AC-X: descripción de cómo el fix lo corrige

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `ruta/al/archivo.ts`
- **Qué cambia:** descripción en una línea

## Por qué no se detectó antes
<!-- Qué red debió atraparlo y por qué no lo hizo. Las respuestas habituales: no había test en
     esa capa; el test existía y no corría solo; solo ocurre con datos reales; solo con dos
     personas a la vez; solo en producción; nadie pensó en ese caso.
     Si la respuesta describe una clase de error y no solo este caso, va a /harness-feedback. -->
...

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `ruta/archivo.spec.ts > nombre del test` ✓
