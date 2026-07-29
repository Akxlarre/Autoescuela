# Asignación ASG-b-010 — Fix H-016: Portal Instructor corre sobre datos MOCK

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

`instructor-clases.facade.ts:53` tiene un flag hardcodeado `private readonly useMock = true;` (comentario: "Mock switch para revisión de flujo") que bypassea toda la lógica real de Supabase en `fetchTodayClasses()`, `loadClassDetail()`, `startClass()`, `finishClass()`, `saveEvaluation()` y `fetchUpcomingDays()`. Un instructor real ve alumnos falsos ("Juanito Pérez (Mock)") y puede intentar iniciar una clase que no existe. La rama real de código YA existe completa en el mismo archivo, simplemente nunca se ejecuta.

## Alcance sugerido

- **No es tan simple como cambiar `true` a `false`**: `instructor-clases.facade.spec.ts` solo testea el modo mock — la rama real de Supabase tiene 0% de cobertura de tests. Escribir tests para la rama real PRIMERO (siguiendo `.claude/rules/testing-tdd.md`, TDD obligatorio para lógica de facades).
- Una vez con cobertura, activar `useMock = false` y verificar en vivo (login `instructor@test.com`, revisar que "Mi Horario"/"Mis Horas" — que ya usan datos reales — coincidan con lo que ahora muestra el dashboard/Iniciar Clase).
- Fuera de scope: no es necesario borrar el código mock si sirve para tests/demos, pero el flag NO debe quedar en `true` por defecto en producción.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-016 — el hallazgo más severo de la Fase 1, con causa raíz exacta y el riesgo del fix ya documentado.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/instructor-clases.facade.ts`
- `src/app/core/facades/instructor-clases.facade.spec.ts`

## Confirmación desde la reunión con el cliente 2026-07-28

El cliente reportó de forma independiente: *"Vista de instructores tiene muchos datos mock."*
Es el **mismo problema** visto desde el lado del usuario final — confirma que H-016 ya es
visible en el uso real, no una deuda interna. Se absorbe acá, sin crear ASG nueva.

Al cerrar este track, verificar explícitamente que **no queden datos mock visibles en ninguna
vista del portal de instructores**, no solo en las 6 funciones listadas arriba.

## Notas para quien la reclame

- **Prioridad Crítica** — riesgo real de que un instructor intente operar sobre datos falsos.
- ⚠️ **Se solapa con ASG-b-036** (exclusión mutua + cierre automático de clases), que toca
  `startClass()`/`finishClass()` en este mismo archivo. No tiene sentido validar exclusión mutua
  contra la rama mock: idealmente esta asignación se cierra primero, o se toman juntas.
- El riesgo de "arreglar mal" es real: sin tests para la rama real, activar el flag podría reemplazar un bug conocido y visible por uno invisible. No saltarse el paso de tests.
