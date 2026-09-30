# Asignación ASG-i-034 — Testing: Gestión de instructores, secretarias y usuarios

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/034-instructores-secretarias-usuarios.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Alta y edición de personal (instructores, secretarias) y usuarios en general: cuentas de Auth +
tabla pública, invitación/activación, asignación de sede y grants multi-sede. Un error acá deja
personas sin acceso, con acceso de más, o con Auth y BD desincronizados.

**Clasificación:** **Integración** · dificultad **Media** · rutas: `/app/admin/{instructores,secretarias,usuarios}`,
`/app/secretaria/instructores`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0004-m` (instructores multi-sede), `0017-b` (grant multi-sede de secretaria),
  `0014-m` (tarifa por hora), `fix-029-i` (error real de edge function visible),
  `fix-168/169-m` (activación por invitación).

**2. E2E manual**
- Crear instructor → aparece en los pickers de agenda de su sede (y de ambas si tiene "ambas").
- Crear secretaria → invitación → activación → login → solo ve su sede.
- Otorgar/revocar el grant multi-sede con la secretaria logueada → cambia en vivo sin re-login.
- Editar email a uno ya usado → rechazo con mensaje claro, sin desincronizar Auth.
- Desactivar un usuario → no puede entrar; sus datos históricos se mantienen.
- Documentos del instructor desde su ficha (cruza con `ASG-i-033`).

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Email duplicado → mensaje de error específico.
- Instructor "ambas sedes" visible en el picker de las 2 sedes.

## Fuera de alcance

- Portal del instructor por dentro.

## Referencias

- `docs/UAT-PLAN.md` Paquete 6 · `docs/RBAC.md` · specs `0004-m`, `0017-b`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- La activación por invitación necesita un correo real o el inbox local de Supabase (Inbucket/Mailpit).
