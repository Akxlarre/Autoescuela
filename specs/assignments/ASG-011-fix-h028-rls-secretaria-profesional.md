# Asignación ASG-011 — Fix H-028: RLS bloquea a la secretaria en matrícula Profesional (403)

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

La secretaria de una sede CON Academia Profesional no puede completar NINGUNA matrícula profesional: al llegar al paso de subir la foto de carnet, la consola muestra `403 Forbidden` en `POST/PATCH /rest/v1/student_documents?on_conflict=enrollment_id,type` y la UI queda congelada en "Subiendo foto..." para siempre, sin avisar el error. Confirmado como bug de rol (no general): la MISMA matrícula, retomada como admin, sube el documento sin ningún problema.

## Alcance sugerido

- Revisar la policy RLS de `INSERT`/`UPDATE` en `student_documents` — probablemente solo contempla `'admin'` para el contexto profesional y excluye `'secretary'`, a diferencia de Clase B donde sí funciona para secretaria.
- Escribir la migración SQL correctiva (idempotente, numerada, siguiendo `.claude/rules/database.md`).
- Adicional recomendado (no bloqueante): agregar manejo de error visible en la UI para que un 403 futuro no deje al usuario congelado sin feedback — mismo patrón de UX roto que H-024.
- Fuera de scope: no tocar las policies de Clase B, que ya funcionan bien.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-028 — confirmado reproduciendo el mismo trámite como admin vs. secretaria con la misma matrícula (`enrollment_id=122`).

## Notas para quien la reclame

- **Prioridad Crítica** — bloquea por completo el único flujo de negocio que esa secretaria debería poder hacer.
- Verificar en vivo con `secretaria2@test.com` (Conductores Chillán, sede CON Profesional) después del fix.
