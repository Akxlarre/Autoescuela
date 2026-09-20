# Asignación ASG-i-013 — Bloquear matrícula pública online (/inscripcion) para el piloto

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-18
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-09-19
> **resulting_track:** fix-255-m-piloto-guard-fase-portales-inscripcion

---

## Contexto / Objetivo

Misma tanda de decisión de alcance del piloto (ver `ASG-i-008` a `ASG-i-012` y el documento
"Piloto Secretaría-Admin"): la matrícula pública online (`/inscripcion`,
`/inscripcion/retorno`) **no forma parte de la primera entrega** — no se va a enlazar desde
el sitio web público, así que en teoría nadie llega a ella.

Eso no es lo mismo que estar bloqueada. Diferencias concretas con los módulos ya ocultos:

- **No tiene ningún guard** — a diferencia de `/app/**` (que exige `authGuard`/`hasRoleGuard`),
  `/inscripcion` está fuera del `AppShell` y no pasa por ningún `canActivate`. Cualquiera que
  escriba la URL, la encuentre en el código fuente, en el historial de git, o la adivine, entra
  directo.
- **Procesa pagos reales** por pasarela (`PublicEnrollmentFacade` + Edge Function
  `public-enrollment`) — no es una pantalla informativa, mueve dinero de verdad.
- Es exactamente el escenario que motivó esta asignación: al decidir el alcance de `ASG-m-002`
  (mover Pago antes de Firma en el wizard), se identificó que el flujo público es el único
  donde un pago real por pasarela podría quedar "huérfano" (pagado, nunca firmado) sin que haya
  una secretaria presente para cancelar en el momento — riesgo que no existe en el flujo
  presencial. Bloquear este flujo ahora evita tener que resolver ese caso en esta fase.

## Alcance sugerido

- Bloquear `/inscripcion` y `/inscripcion/retorno` con el mismo mecanismo de "fase" que se
  diseñe/ya exista en `ASG-i-008` (reutilizar, no duplicar un segundo sistema de flags).
- Redirigir a la misma pantalla de aviso de `ASG-i-010` ("módulo no habilitado todavía") en
  vez de dejar pasar la petición.
- Confirmar que ningún otro flujo (ej. un link enviado por email a alguien con una matrícula
  a medio camino) dependa de que esta ruta siga abierta — si existieran borradores en curso al
  momento del despliegue, decidir si se los deja expirar (ya tienen expiración de 24h) o se
  avisa a quien corresponda antes de bloquear.

## Fuera de alcance

- No tocar `PublicEnrollmentFacade` ni la lógica de negocio del flujo — solo el acceso a la
  ruta.
- No es una decisión permanente: cuando el equipo decida enlazar la matrícula pública desde el
  sitio web, se revierte el guard igual que con Instructor/Alumno.

## Referencias

- `src/app/app.routes.ts` — rutas `inscripcion` e `inscripcion/retorno` (fuera de `AppShell`,
  sin guard hoy).
- `src/app/core/facades/public-enrollment.facade.ts`.
- Documento "Piloto Secretaría-Admin" (artifact, 2026-09-14).
- Discusión que originó esta asignación: `ASG-m-002` (reordenar Pago/Firma), decisión de
  2026-09-18 de acotar ese cambio al flujo presencial y bloquear el público en vez de resolver
  el caso de pago huérfano por pasarela.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/app.routes.ts` (mismo archivo que `ASG-i-008`/`ASG-i-009` — coordinar para no
  pisarse si se toma en paralelo).

## Notas para quien la reclame

- Si ya se resolvió el mecanismo de "fase" de `ASG-i-008`, esta asignación debería ser rápida
  — es aplicar el mismo patrón a 2 rutas más.
- P1 porque, a diferencia de los otros módulos ocultos, este mueve dinero real si alguien
  llega a usarlo sin querer.
