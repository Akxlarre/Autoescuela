# Fix: H-028 — RLS bloquea a la secretaria en matrícula Profesional (403)
> id: fix-054-m-h028-rls-secretaria-documentos-profesional
> refs: ASG-011
> status: in_progress
> created: 2026-07-23

## Root Cause

[Heredado de ASG-011, a confirmar]: La secretaria de una sede CON Academia Profesional no puede completar NINGUNA matrícula profesional: al llegar al paso de subir la foto de carnet, la consola muestra `403 Forbidden` en `POST/PATCH /rest/v1/student_documents?on_conflict=enrollment_id,type` y la UI queda congelada en "Subiendo foto..." para siempre, sin avisar el error. Confirmado como bug de rol (no general): la MISMA matrícula, retomada como admin, sube el documento sin ningún problema. Hipótesis: la policy RLS de `INSERT`/`UPDATE` en `student_documents` solo contempla `'admin'` para el contexto profesional y excluye `'secretary'`, a diferencia de Clase B donde sí funciona para secretaria.

## ACs Afectados

- Ninguno — fix autónomo (originado de Asignación ASG-011, no de una spec previa).

## Cambio

- **Archivo:** Migración SQL nueva en `supabase/migrations/` (policy RLS de `INSERT`/`UPDATE` en `student_documents`)
- **Qué cambia:** Habilitar rol `'secretary'` en la policy de matrícula Profesional, igualándola al comportamiento ya funcional de Clase B.
- Adicional recomendado (no bloqueante): manejo de error visible en la UI para que un 403 futuro no deje al usuario congelado sin feedback.
- Fuera de scope: no tocar las policies de Clase B, que ya funcionan bien.

## Test de Regresión

- Verificar en vivo con `secretaria2@test.com` (Conductores Chillán, sede CON Profesional): completar matrícula profesional hasta subir foto de carnet sin 403.
