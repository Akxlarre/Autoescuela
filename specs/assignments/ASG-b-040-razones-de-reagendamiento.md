# Asignación ASG-b-040 — Razones de reagendamiento (enum + "otro")

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-28
> **created_by:** b

---

## Contexto / Objetivo

Anotación de la reunión (2026-07-28):

> *"Razones para reagendar: temas médicos, pasa comúnmente, hacer enum y dejar opción otro."*

Hoy se reagenda sin registrar por qué. El cliente quiere una lista cerrada de razones (con
"otro" + texto libre como escape) para poder ver después qué está causando los reagendamientos.

## Hallazgo relevante — dónde guardar la razón

Reagendar una sesión `cancelled`/`no_show` (RF-053,
`AdminAlumnoDetalleFacade.reagendarClasesPenalizadas()`) **recicla in-place la misma fila** de
`class_b_sessions`; nunca inserta una fila nueva (documentado en `indices/DATABASE.md`, fix
`20260709120100`).

Consecuencia: **no hay dónde guardar la razón hoy**, y si se guarda en la propia fila se pisa
cada vez que se reagenda de nuevo. Decidir entre:
- columna `reschedule_reason` en `class_b_sessions` (simple, solo guarda la última razón), o
- tabla de historial de reagendamientos (permite ver el patrón, que es lo que el cliente
  realmente quiere si dice *"pasa comúnmente"*).

Recomendación: **historial**, porque el valor del requerimiento está en el agregado, no en el
dato suelto.

## Preguntas abiertas (no bloqueante — se puede diseñar sin esto)

1. **¿Cuál es la lista concreta de razones?** El cliente solo nombró "temas médicos" y "otro".
   Pedir la lista completa. Candidatas a confirmar: médica, laboral, viaje, problema del
   vehículo, ausencia del instructor, clima.
2. ¿La razón la elige quien reagenda (secretaría) o hay que registrar lo que dijo el alumno?

## Alcance sugerido

- Migración: enum/tabla de razones + dónde se persiste.
- Campo obligatorio de razón en el flujo de reagendamiento, con "otro" habilitando texto libre.
- (Deseable) que la razón sea visible en la ficha del alumno.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/admin-alumno-detalle.facade.ts` (`reagendarClasesPenalizadas()`)
- `supabase/migrations/` (migración nueva)

## Notas para quien la reclame

- La pregunta 1 **no bloquea**: se puede construir todo con una lista provisional y ajustar los
  valores después. No esperar la reunión para empezar.
- Si se elige la tabla de historial, aprovechar para registrar también `original_instructor_id`
  y las fechas vieja/nueva — el modelo ya guarda `original_instructor_id` pero no el resto.
