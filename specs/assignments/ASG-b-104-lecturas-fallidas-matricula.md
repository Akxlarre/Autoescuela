# Asignación ASG-b-104 — Lecturas fallidas en la matrícula (presencial y pública)

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-11-20
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Parte de la spec **`0060-b-lecturas-fallidas-como-ceros`**, ya aprobada y con las etapas 0, 1 y 3a
cerradas. Esta asignación cubre las tareas **T2.1 y T2.2** de su `tasks.md`: las pantallas de
matrícula. Hoy sus facades leen `data` sin mirar `error`. Si la red falla a mitad del wizard, un
precio, un cupo o un horario pueden aparecer como "sin datos" o en 0, y la secretaria podría
matricular con ese valor. El objetivo es que toda lectura lance, que una lectura que decide un
precio, un cupo o un horario detenga el paso con un error y "Reintentar", y que la matrícula
pública muestre el error aunque no haya sesión iniciada.

**No se crea un track nuevo.** Al reclamarla, el track resultante es `0060-b` y se trabaja sobre sus
tareas, igual que en las etapas que ya se cerraron.

## Alcance sugerido

- **T2.1, `enrollment.facade.ts`.** Es el facade más grande que queda (unas 77 consultas) y va en un
  **PR solo**. Antes de tocar las lecturas, clasificarlas en `tasks.md`: las que bloquean el paso y
  las que solo muestran un aviso. Al cerrar, la suite E2E de matrícula presencial tiene que quedar
  en verde.
- **T2.2:** `enrollment-documents`, `public-enrollment` y `student-enrollment-context`.
  `public-enrollment` está bloqueada en el piloto (`/inscripcion`), así que se prueba en local.
- Cada facade cumple el **DoD-F** de `tasks.md` y sale de `PENDING` en
  `unchecked-reads.guard.spec.ts`.
- Validación de la etapa (T2.6) para estas pantallas: casos A y B en claro y oscuro, y X01 contra el
  build de producción.
- **Fuera de alcance:** `admin-pre-inscritos` (va en ASG-b-105) y el resto de la etapa 2 (va en
  ASG-b-106).

## Referencias

- Spec, plan y tareas: `specs/specs/0060-b-lecturas-fallidas-como-ceros/`
- Referencias de implementación: `pagos.facade.ts` (T1.1) y `enrollment-payment.facade.ts` (T1.5)
- Contrato: `.claude/rules/swr-pattern.md` §"Errores de carga"
- Asignación madre: ASG-b-102

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/enrollment.facade.ts`
- `src/app/core/facades/enrollment-documents.facade.ts`
- `src/app/core/facades/public-enrollment.facade.ts`
- `src/app/core/facades/student-enrollment-context.facade.ts`
- `src/app/core/facades/unchecked-reads.guard.spec.ts`
- `e2e/transversal-shell.spec.ts`

## Notas para quien la reclame

- Está asignada a `i` porque Ignacio está con `fix-058-i` (testing de la matrícula presencial) y
  conoce ese wizard. Ese testing sirve para ver qué lecturas deciden algo antes de tocarlas.
- Se va a tocar `unchecked-reads.guard.spec.ts` en paralelo con ASG-b-105 y ASG-b-106. Cada uno
  saca solo sus líneas de `PENDING`. El conflicto de merge es trivial.
- Riesgo de la spec (§8): una lectura que hoy falla siempre (RLS, columna inexistente) va a empezar
  a mostrar error. Hay que probar con admin y con secretaria antes de mergear.
