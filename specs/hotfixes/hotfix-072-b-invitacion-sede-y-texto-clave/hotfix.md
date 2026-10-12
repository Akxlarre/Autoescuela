# Hotfix: La invitación de secretaria dice "Conductores Chillán" para cualquier sede y la pantalla habla de una "contraseña temporal" que no existe
> id: hotfix-072-b-invitacion-sede-y-texto-clave
> refs: ASG-i-034 (checklist 034, caso L01) — visto por el owner al activar la cuenta de prueba
> status: closed
> created: 2026-10-12

## Problema
1. El correo "Activa tu cuenta de secretaria" lleva "Conductores Chillán" fijo en el encabezado: a una
   secretaria de Autoescuela Chillán le llega con el nombre de la otra sede.
2. La pantalla donde crea su clave dice "debes actualizar tu contraseña temporal en tu primer inicio de
   sesión". Desde fix-182-b las cuentas nacen sin contraseña (se activan por enlace): nadie tiene una
   temporal.

## Cambios
- **Archivo:** `supabase/functions/_shared/staff-invite-email.ts` (+ test) — recibe `schoolName` (el
  nombre de la sede) y lo pone en el encabezado.
- **Archivo:** `supabase/functions/create-secretary/index.ts` — lee el nombre de la sede asignada y lo
  pasa. **Requiere deploy** (aprobación del owner).
- **Archivo:** `src/app/features/auth/force-password-change/force-password-change.component.ts` — texto
  del primer ingreso: "Crea tu contraseña".

## Verificación
- Test de la plantilla (`staff-invite-email.test.ts`); `ng build`, `lint:arch`; la pantalla en el navegador.

## Resultado (2026-10-12)
- `staff-invite-email.test.ts` 7/7 (+3: nombre de la sede, marca genérica sin sede, escape), rojo → verde.
- `ng build` OK, `lint:arch` 0 errores (182).
- Pantalla: el texto es estático (título "Crea tu contraseña", botón "Guardar y entrar"); no se pudo abrir
  en el navegador porque la única cuenta en primer ingreso ya se activó.
- Deploy (aprobado 2026-10-12): `create-secretary` v20, idéntico a esta rama. Los primeros 5 intentos fallaron con 500 "internal error": los archivos del checkout tenían fin de línea CRLF; con LF subió (v19 fue un redeploy de diagnóstico con el código de `main`).
