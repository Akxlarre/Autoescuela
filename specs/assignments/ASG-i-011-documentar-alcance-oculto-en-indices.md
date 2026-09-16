# Asignación ASG-i-011 — Documentar el alcance "oculto en esta fase" en los índices

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P3
> **created:** 2026-09-15
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Housekeeping para que el próximo agente (o dev) que toque `indices/ROUTES.md` no interprete
las rutas ocultas por ASG-i-008/ASG-i-009 como código muerto y proponga borrarlas. Dejar
registrado, junto a cada ruta afectada, que está **oculta temporalmente por decisión de
alcance del piloto (2026-09-15)**, no abandonada.

## Alcance sugerido

- Agregar una nota (encabezado corto, o columna de estado si `ROUTES.md` ya tiene tabla) en
  `indices/ROUTES.md` sobre:
  - Todo `/app/instructor/**` y `/app/alumno/**` (ASG-i-008).
  - Las 8 rutas de Clase Profesional recortadas (ASG-i-009): pre-inscritos, relatores,
    promociones, asistencia, certificados, evaluaciones, archivo, ex-alumnos-profesional
    (admin y secretaria).
- Enlazar a los tracks resultantes de ASG-i-008/009 una vez existan, para que quien lea el
  índice pueda ir directo al detalle.

## Fuera de alcance

- No es trabajo de código — solo documentación del índice.

## Referencias

- `indices/ROUTES.md`

## Archivos involucrados (opcional, para detectar solapes)

- `indices/ROUTES.md`

## Notas para quien la reclame

- Hacerla **después** de que ASG-i-008 y ASG-i-009 tengan track (para poder linkear), no antes.
- Baja prioridad — no bloquea el lanzamiento, pero evita confusión a futuro.
