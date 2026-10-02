# Asignación ASG-i-039 — Sacar las credenciales de prueba de la pantalla de login

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-09-30
> **resulting_track:** hotfix-007-i-credenciales-prueba-login-solo-dev

---

> **Confirmación (2026-09-30): ✅ CONFIRMADA.** Las credenciales del recuadro funcionan contra la
> BD del piloto (`skvekggejikzxhzsjmkz`): se usaron para iniciar sesión como `secretaria@test.com` y
> `secretaria2@test.com` durante la confirmación de la tanda.

## Contexto / Objetivo

`/login` muestra un recuadro "Credenciales de prueba" con todas las cuentas de test
(`admin@test.com`, `secretaria@test.com`, …) y la contraseña `Test123456`, sin ningún
`isDevMode()`. El propio comentario del código dice "Eliminar antes de producción". Si esas
cuentas existen en el ambiente que se entregue, cualquiera entra como admin. **Verificado en el
código** (`login.component.ts:64-85`); no requiere confirmación en vivo.

## Alcance sugerido

- Eliminar el bloque, o como mínimo envolverlo en `isDevMode()`/flag de environment para que no
  llegue al build de producción.
- Revisar si el mismo texto aparece en algún otro lado (grep `Test123456`).
- Recomendado aparte: rotar o desactivar las cuentas `*@test.com` en el ambiente del piloto.

## Referencias

- `specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md` S3
- `specs/testing-piloto/000-resumen.md` grupo 2

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/auth/login/login.component.ts`

## Notas para quien la reclame

- Cambio de minutos; conviene hacerlo antes que cualquier otra cosa de la tanda.
