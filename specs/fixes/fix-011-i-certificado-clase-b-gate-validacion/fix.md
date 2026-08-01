# Fix: Certificado Clase B sin validar 12 prácticas (gate server-side) + indicador de criterio admin/secretaría
> id: fix-011-i-certificado-clase-b-gate-validacion
> refs: ASG-b-014
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
[Heredado de ASG-b-014, a confirmar]:
- **H-025 (grave)**: `supabase/functions/generate-certificate-b-pdf/index.ts` nunca valida que existan 12 `class_b_sessions` completadas antes de emitir el PDF — solo valida que el `enrollment_id` exista. El admin ve TODOS los alumnos activos/completados sin el filtro `certificate_enabled` (a diferencia de secretaría), así que el botón "Generar" está disponible hoy para alumnos con 0/12 prácticas. Problema de integridad de negocio y potencial cumplimiento normativo (el PDF cita la Ley N° 19.628).
- **H-012 (menor, relacionado)**: la diferencia de criterio "elegible" entre admin (sin filtro) y secretaría (`certificate_enabled=true`) es intencional y está documentada en el código (`certificacion-clase-b.facade.ts:400-431`), pero la UI nunca comunica esta diferencia.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio

### H-025 — gate server-side (la barrera real)
- **`supabase/functions/generate-certificate-b-pdf/index.ts`**: nueva validación justo después de resolver el `enrollment` — cuenta `class_b_sessions` con `evaluation_grade IS NOT NULL` para ese `enrollment_id` (mismo criterio exacto que ya usa `certificacion-clase-b.facade.ts` para el 12/12 de la UI, no `status='completed'` que se usa solo para las fechas del texto del certificado). Si `< 12` y no hay bypass admin, responde `400` con el mensaje específico ("no cumple el mínimo de clases prácticas completadas (X/12)"), mismo estilo `jsonRes({ error }, code)` que el resto de la función.
- **Bypass admin server-side**: la función ahora acepta `force: boolean` en el body. Se resuelve el rol del caller (`users.select('id, roles ( name )')`, mismo patrón ya usado en `create-secretary`) — el gate solo se salta si `force === true` **y** el rol resuelto es `admin`. Una secretaría nunca puede saltarlo aunque mande `force: true`.

### H-025 — UI
- **`src/app/core/facades/certificacion-clase-b.facade.ts`**: `generarCertificado(enrollmentId, force = false)` ahora propaga `force` al body de la Edge Function. El toast de error ahora muestra `data?.error` (el mensaje específico del gate) en vez de un genérico que ocultaba la razón real.
- **`src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts`**: nuevo output `generarCertificadoForzado` — `confirmarGenerar()` (el flujo de bypass admin que ya existía) ahora emite por ese output en vez del normal, para que el smart component pueda pasar `force: true` explícitamente. Nuevo método `isBlockedForRow(alumno)`: deshabilita el botón "Generar" (`[disabled]`, desktop y mobile) más un `title` explicando cuántas prácticas faltan, cuando `!isAdmin() && clasesCompletadas < clasesTotales`. Antes, la secretaría podía clickear "Generar" sin feedback (no pasaba nada, silencioso); el admin sigue sin bloquearse porque su click debe abrir la fila de confirmación de bypass.
- **`admin-certificacion.component.ts`**: agregado `(generarCertificadoForzado)="facade.generarCertificado($event, true)"`. `secretaria-certificados.component.ts` no necesitó cambios — nunca dispara ese output porque la secretaría nunca es admin.

### H-012 — indicador de criterio
- **`certificacion-clase-b-content.component.ts`**: nuevo banner entre el hero y la tabla, gateado por el `isAdmin` input ya existente: "Vista admin: se muestran todos los alumnos..." vs "Vista secretaría: solo se muestran alumnos habilitados...". Cubre ambos roles automáticamente porque ambos smart components (`admin-certificacion` y `secretaria-certificados`) renderizan el mismo componente compartido.

## Bug encontrado en verificación visual: banner H-012 rompía el layout fill-screen
El primer banner (agregado como hijo directo del `bento-grid`) rompió el contenedor `bento-grid--fill-screen`: la tabla quedaba vacía y el toolbar (buscador + "Generar Pendientes") se desplazaba abajo. Causa: el fill-screen shell espera una jerarquía plana específica (hero + una única celda `bento-fill`) — insertar un tercer hijo de nivel superior rompía ese template.
- **Fix:** el banner se movió de ser un hijo directo del `bento-grid` a vivir **dentro** de la card existente (`bento-fill`), justo después del toolbar y antes de la tabla — mismo resultado visual, sin tocar la estructura del grid.

## Test de Regresión
- `src/app/core/facades/certificacion-clase-b.facade.spec.ts` (extendido): nuevo test confirma `force: false` por defecto en el body de la Edge Function; nuevo test confirma que `generarCertificado(id, true)` propaga `force: true`; nuevo test confirma que el toast de error muestra el mensaje específico (`data.error`) cuando el gate lo devuelve. Se ajustó el test preexistente del body (ahora incluye `force: false`).
- `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.spec.ts` (extendido): ajustado el test de `confirmarGenerar()` (ahora verifica que emite por `generarCertificadoForzado`, no por el output normal); 3 tests nuevos para `isBlockedForRow()` — bloquea a secretaría sin prácticas completas, NO bloquea a admin (debe poder abrir el bypass), NO bloquea a nadie con 12/12.
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores, `npx vitest run` sobre ambos specs → **27/27 verde** (20 + 7).
- Verificación visual pendiente: (a) desplegar la Edge Function actualizada (`supabase functions deploy generate-certificate-b-pdf`, o el flujo que uses); (b) como secretaría, confirmar que el botón "Generar" aparece deshabilitado (con tooltip) para un alumno con prácticas incompletas; (c) como admin, confirmar que el flujo de bypass sigue funcionando y que ahora manda `force: true` (revisar Network o que el certificado se genere igual); (d) confirmar que el banner de "Vista admin"/"Vista secretaría" aparece arriba de la tabla en ambos roles; (e) intentar generar un certificado real con un alumno de <12 prácticas sin bypass y confirmar que la Edge Function lo rechaza con 400.
