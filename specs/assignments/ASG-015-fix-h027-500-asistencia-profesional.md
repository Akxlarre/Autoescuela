# Asignación ASG-015 — Fix H-027: 500 real en alertas de asistencia Profesional con filtro de sede

> **status:** completada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-07-23
> **resulting_track:** fix-060-m-h027-alertas-asistencia-profesional-sede

---

## Contexto / Objetivo

Las queries `checkYellowAttendance`/`checkRedAttendance` (`dashboard-alerts.facade.ts`) contra la vista `v_professional_attendance` devuelven **500 Internal Server Error** real (no un simple 400/403) cuando se filtra por una sede específica no nula. Confirmado que con `branchId=null` (admin en "Todas las sedes") las mismas queries responden `200 OK` con datos correctos. Las alertas de asistencia crítica/en riesgo de Clase Profesional nunca se calculan para ninguna secretaria con acceso a Profesional, sin avisar del fallo.

## Alcance sugerido

- Revisar la definición SQL de `v_professional_attendance` — el error sugiere un JOIN o cast de tipo mal formado específicamente en la rama que filtra por sede.
- Escribir la migración SQL correctiva.
- Verificar en vivo con `secretaria2@test.com` (sede CON Profesional) tras el fix — debería ver las mismas alertas que ve el admin filtrando a esa sede.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-027 (con el refinamiento que acota el error específicamente a la rama con `branchId` no nulo).

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/dashboard-alerts.facade.ts`
- Migración SQL correctiva de la vista `v_professional_attendance` (nueva)

## Notas para quien la reclame

- A diferencia de la mayoría de los hallazgos del audit (400 silenciosos, fallos de UX), este es un 500 real del backend — la causa está en SQL, no en el frontend.
