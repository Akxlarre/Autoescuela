# Fix: El contrato firmado se envía por correo al confirmar la matrícula
> id: fix-318-m-el-contrato-firmado-se-envia-por-correo-al-confirmar-la-matricula
> refs: ASG-i-024, fix-034-i
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
El Paso 6 del wizard de matrícula afirma "Se ha enviado una copia del contrato al email del
alumno", pero nada en el sistema envía ese correo. Al confirmar la matrícula solo se llama a
`activate-student-account`, que manda la invitación para activar la cuenta: la primera vez usa el
correo nativo de Supabase Auth, que no admite adjuntos, y si el alumno ya tiene su cuenta activa
(una re-matrícula) no manda nada. El contrato firmado queda guardado en Storage
(`contracts/<matrícula>/contract.<ext>`) y registrado en `digital_contracts`, sin salir nunca hacia
el alumno. Encontrado al ejecutar `024a` O03 en `fix-264-m`.

**Decisión del owner (Matías, 2026-10-05):** el contrato debe llegar por correo; una matrícula
completada por el wizard siempre incluye la subida del contrato firmado.

## ACs Afectados
- Al confirmar una matrícula por el wizard, el alumno recibe un correo con el contrato firmado
  adjunto, también en una re-matrícula (cuando no hay invitación).
- Si el envío falla, la matrícula queda confirmada igual y quien la hizo recibe un aviso.
- Solo admin y secretaria pueden disparar el envío.

## Cambio
- **Archivo:** `supabase/functions/send-enrollment-contract-email/index.ts` (nuevo) — busca la
  matrícula, descarga el contrato firmado de Storage y lo envía por SMTP con el nombre y los
  colores de la sede. Va en un correo propio, no dentro de la invitación, por las dos razones de
  arriba.
- **Archivo:** `supabase/functions/_shared/contract-email.ts` (nuevo) — asunto, nombre del adjunto
  y HTML del correo, como funciones puras.
- **Archivo:** `src/app/core/facades/enrollment.facade.ts` — `confirmEnrollment()` llama a la
  función, sin bloquear la confirmación.

## Test de Regresión
- `supabase/functions/_shared/contract-email.test.ts` (Deno, 10 tests) ✓
- `enrollment.facade.spec.ts > confirmEnrollment > correo con el contrato firmado — fix-318-m`
  (3 tests) ✓

## Verificación
2026-10-05: los 10 tests de Deno y los 84 del facade pasan; sin errores de compilación. **El envío
real no está probado**: la función no está desplegada y no se puede ejecutar localmente (necesita
los secretos SMTP). Lo verificado es el contenido del correo, el nombre y tipo del adjunto, y que
el wizard llama a la función al confirmar y avisa si falla.

## Progreso
El track sigue abierto: el código está escrito y probado, pero el arreglo no se puede dar por
hecho hasta ver llegar el correo.

- [x] Contenido del correo y adjunto (`_shared/contract-email.ts`), con tests Deno.
- [x] Función `send-enrollment-contract-email`.
- [x] Llamada desde `confirmEnrollment()` con aviso si falla, con tests unitarios.
- [x] **Desplegar la función** — desplegada por Matías el 2026-10-05 (dos veces: la segunda con
  la respuesta del servidor de correo incluida).
- [x] **Probar el envío real** — hecho el 2026-10-05, ver abajo.
- [x] Cerrar el track.

## Prueba del envío real (2026-10-05)
Con la función desplegada, llamada directamente (sesión de admin) para la matrícula 0083 del
alumno de prueba, que es una re-matrícula y tiene su contrato firmado subido. Al alumno se le
cambió antes el correo, desde "Editar Perfil", por una casilla temporal que Matías revisó.

- Casos sin envío: sin sesión → 401; dato inválido → 400; matrícula inexistente → 404; matrícula
  sin contrato firmado (la 0081) → 400 "La matrícula no tiene un contrato firmado".
- **Primer envío:** la función respondió 200 pero el correo no apareció en la casilla, ni tras
  actualizarla. No se supo por qué (esa versión no devolvía lo que contestó el servidor de correo).
- **Segundo envío**, con la función ya devolviendo esa respuesta: el servidor aceptó 1 destinatario,
  rechazó 0 y contestó `250 OK`; adjunto de 607 bytes. **Este sí llegó**, confirmado por Matías con
  capturas: remitente `no-reply@autoescuelachillan.cl`, asunto "Tu contrato de matrícula Nº 0083 —
  AutoEscuela Chillán", encabezado con los colores de la sede, saludo con el nombre del alumno,
  curso y Nº de matrícula, y el adjunto se abre.
- De la captura salió un ajuste: en el recuadro de curso y matrícula el texto quedaba pegado a los
  bordes. Corregido en `_shared/contract-email.ts` (el relleno pasa de la tabla a las celdas);
  **ese ajuste necesita un nuevo despliegue** para verse.

**Lo que NO se probó de punta a punta:** que el correo salga solo al confirmar una matrícula en
el wizard. Esa llamada está cubierta por los 3 tests unitarios del facade; probarla en la app
implica crear otra matrícula de prueba permanente.

El alumno de prueba (matrícula 0083) quedó con el correo temporal `cefomo3309@abowned.com`.
