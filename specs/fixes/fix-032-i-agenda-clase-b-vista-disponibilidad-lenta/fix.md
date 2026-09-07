# Fix: Agenda Clase B — vista de disponibilidad tarda ~8s al cambiar de semana
> id: fix-032-i-agenda-clase-b-vista-disponibilidad-lenta
> refs: 0008-i-reset-y-poblar-datos-prueba
> status: in_progress
> created: 2026-09-07

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Al poblar la BD de prueba con volumen realista (~1680 filas en `class_b_sessions`, spec
`0008-i`), se detectó que la vista `v_class_b_schedule_availability` tarda **8.19s** en
responder al cambiar de semana en la Agenda (confirmado en el tab Network del navegador:
`v_class_b_schedule_availability?select=instructor_...` = 8.19s vs. `class_b_sessions?select=...`
= 668ms-1.15s en la misma pantalla).

Una query directa equivalente contra `class_b_sessions` con el mismo filtro
(`instructor_id` + rango de fecha) corre en **0.359ms** con `EXPLAIN ANALYZE` (confirmado
contra la BD real, ver conversación de origen) — descarta que el volumen de datos en sí
sea el problema. La vista es la que degrada.

Con el volumen bajo que existía antes de `0008-i` (unas pocas decenas de sesiones), esta
lentitud nunca fue perceptible — es un bug preexistente, no introducido por el reset/seed,
que quedó expuesto recién al probar con datos realistas.

**Hipótesis a confirmar durante la implementación** (no confirmada aún, requiere leer la
definición SQL de la vista):
- La vista no aplica el filtro de fecha/instructor ANTES de cruzar con otras tablas
  (calcula disponibilidad para un rango más amplio del necesario y filtra después), o
- Falta un índice de soporte para el/los JOIN que arma internamente, o
- Hace cálculo repetido por cada slot/instructor sin materializar resultados intermedios.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno de `0008-i` directamente (esa spec es sobre datos, no sobre performance) — este
  fix es autónomo, descubierto como efecto colateral de validar `0008-i` con volumen real.

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** migración SQL que redefine `v_class_b_schedule_availability` (ubicar en
  `supabase/migrations/`, buscar la migración original de la vista primero para no duplicar
  lógica de negocio al reescribirla).
- **Qué cambia:** optimizar la vista (filtrado temprano por fecha/instructor y/o índice de
  soporte) para que el tiempo de respuesta baje a un rango normal (<500ms) con el volumen de
  prueba actual (~1680 sesiones).

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Manual (no hay test automatizado de performance en el proyecto): repetir la medición del
  Network tab del navegador — `v_class_b_schedule_availability` al cambiar de semana en
  `/app/**/agenda` debe responder en <1s con el dataset de `0008-i` cargado (~1680 sesiones).
- `EXPLAIN ANALYZE` de la query subyacente de la vista antes/después, confirmando que deja de
  hacer `Seq Scan` sobre el conjunto completo si esa resulta ser la causa raíz confirmada.
