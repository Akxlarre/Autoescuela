# Asignación ASG-i-044 — Usuarios desactivados siguen entrando, y recuperar contraseña no pide clave nueva

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** b
> **claimed_at:** 2026-10-01
> **resulting_track:** fix-180-b-usuarios-desactivados-siguen-entrando

---

## Contexto / Objetivo

**Sospecha no confirmada en vivo** (tanda de testing 2026-09-29). Tres problemas del ciclo de
cuentas:

1. **Usuario desactivado sigue entrando y operando.** Desactivar solo cambia `users.active`; no
   se banea en Auth, ningún guard ni el login lo revisan, y los helpers de RLS
   (`auth_user_role`, `auth_user_branch_id`) tampoco miran `active`
   (`update-secretary/index.ts:148-155`; `20260301000011_10_rls_policies.sql:28-38`).
2. **Recuperar contraseña no funciona de punta a punta.** El correo se pide sin `redirectTo`
   (verificado en código: `supabase.service.ts:72-74`), la app no maneja el evento
   `PASSWORD_RECOVERY` (`auth.facade.ts:47-64`) y `/recuperar-contrasena` es un stub: al abrir el
   enlace el usuario queda logueado sin fijar clave nueva.
3. **Clave inicial = RUT** y el cambio obligatorio (`first_login`) solo se exige en el cliente
   (`create-secretary/index.ts:122`).

## Alcance sugerido

- **Paso 1, confirmar** con una cuenta de prueba (pasos en §4 de `022`).
- (1): al desactivar, banear/suspender en Auth (`ban_duration`) y cerrar sesiones; agregar el
  chequeo de `active` en los helpers de RLS y en el guard/login.
- (2): `resetPasswordForEmail(email, { redirectTo })` a una pantalla que maneje
  `PASSWORD_RECOVERY` y obligue a fijar la clave nueva; revisar Site URL / Redirect URLs del
  proyecto Supabase.
- (3): evaluar clave inicial aleatoria + invitación, o exigir el cambio en el servidor.

## Referencias

- `specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md` S1, S2 (y sospechas de clave inicial)
- `specs/testing-piloto/034-instructores-secretarias-usuarios.md`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/services/infrastructure/supabase.service.ts`, `src/app/core/facades/auth.facade.ts`,
  `src/app/core/guards/`, pantalla de recuperar contraseña
- `supabase/functions/update-secretary/`, `create-secretary/` y afines
- Migración para los helpers de RLS

## Notas para quien la reclame

- **Estado (2026-10-01):** parte 1 (cuentas desactivadas, puntos 1 y 3-parcial) cerrada en
  `fix-180-b-usuarios-desactivados-siguen-entrando`, en producción. **Parte 2 pendiente:** recuperar
  contraseña de punta a punta (punto 2) y clave inicial = RUT (punto 3) — va en otro track. La
  Asignación sigue `reclamada` hasta cerrar la parte 2.

- Puede partirse en 2 tracks: (1)+(3) cuentas, (2) recuperar contraseña.
