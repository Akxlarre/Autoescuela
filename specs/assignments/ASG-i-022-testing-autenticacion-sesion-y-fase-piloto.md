# Asignación ASG-i-022 — Testing: Autenticación, sesión, roles y bloqueo de fase piloto

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Testing profundo del módulo de acceso para la primera entrega (piloto Admin/Secretaria). Es la
puerta de todo el sistema: si un rol entra donde no debe, o una ruta oculta por la fase piloto
se puede abrir por URL directa, el resto del testing no vale.

**Clasificación:** **Integración/E2E** · dificultad **Media** · rutas: `/login`,
`/recuperar-contrasena`, `/force-password-change`, `/acceso-denegado`, `/modulo-no-disponible`,
guards `authGuard`, `hasRoleGuard`, `roleRedirectGuard`, `pilotPhaseGuard`,
`professionalBranchGuard`, `enrollmentDraftGuard`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de `fix-255-m` (guard de fase), `fix-256-m` / `fix-260-m` (recorte Clase Profesional),
  `fix-041-i` (4 rutas que habían quedado sin guard) y `fix-261-m` (botón de
  `/modulo-no-disponible` según rol).

**2. E2E manual**
- Login válido de cada rol (admin, secretaria) → cae en su dashboard.
- Credenciales inválidas, usuario inactivo, email inexistente → mensaje claro, UI no se cuelga.
- Primer login (`first_login`) → fuerza cambio de contraseña y no deja saltarlo navegando.
- Recuperar contraseña de punta a punta (correo → link → nueva clave → login).
- Logout → no quedan datos del usuario anterior al entrar con otro.
- Secretaria intenta abrir URLs de `/app/admin/**` → acceso denegado.
- **URL directa a cada ruta oculta** (tabla de `pilotPhaseGuard` en `indices/ROUTES.md`: portal
  Instructor, portal Alumno, `/inscripcion`, 7 módulos de Clase Profesional) logueado como admin
  y como secretaria → pantalla "módulo no disponible", nunca el módulo ni un error genérico.
- Secretaria de sede sin Clase Profesional → `professionalBranchGuard` la bloquea.
- Sesión expirada / token vencido a mitad de una acción → vuelve a login sin perder coherencia.
- Menú lateral: no muestra ningún ítem de módulos ocultos, para ningún rol.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Matriz rol × ruta oculta (parametrizada): todas deben terminar en `/modulo-no-disponible`.
- Matriz rol × ruta de otro rol → `/acceso-denegado`.
- Login inválido / logout / re-login con otro rol.

## Fuera de alcance

- Portales Instructor y Alumno por dentro (fuera del piloto; solo se prueba que estén bloqueados).

## Referencias

- `indices/ROUTES.md` (nota de `pilotPhaseGuard`), `src/app/core/config/pilot-phase.config.ts`
- `docs/UAT-PLAN.md` Paquete 7 · `specs/fixes/fix-037-i-qa-visual-piloto/fix.md`
- `docs/RBAC.md`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing). Hallazgos probablemente en `src/app/core/guards/`, `app.routes.ts`,
  `menu-config.service.ts`.

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación, como hizo
  `fix-037-i`. **Cada bug encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- No asumir que lo que el UAT de agosto marcó `[x]` sigue verde: hubo muchos cambios desde entonces.
