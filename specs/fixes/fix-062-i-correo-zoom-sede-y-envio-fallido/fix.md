# Fix: El correo del Zoom dice siempre "Conductores Chillán", y un envío fallido queda como enviado o sin explicar
> id: fix-062-i-correo-zoom-sede-y-envio-fallido
> refs: revisión del envío de Zoom de clases teóricas Clase B pedida por Ignacio (2026-10-23)
> status: done
> closed: 2026-10-23
> created: 2026-10-23

## Root Cause

1. **Marca fija.** `send-zoom-email/index.ts` arma el HTML con "Conductores Chillán", el sello "CC"
   y colores azules fijos. Un alumno de Autoescuela Chillán recibe el correo con el nombre de la
   otra escuela. Los correos del certificado y del contrato ya resolvieron esto (hotfix-159-m) con
   `website_config.config.brand` de la sede y los helpers de `_shared/contract-email.ts`.
2. **Marcado como enviado sin enviar.** `CiclosTeoricosFacade.sendZoomEmail()` estampa
   `zoom_sent_at` siempre que la función responde 200, aunque `sent = 0` (todos los correos
   fallaron en el SMTP). La clase queda como "enviada" y solo se muestra "Envío parcial".
3. **Error sin explicar.** Si la función responde no-2xx (sin destinatarios con correo, enlace no
   https, sin permiso), el `catch` muestra "Error al enviar los correos" y descarta el mensaje real
   que viene en `error.context` (DG-085).

## ACs Afectados

Ninguno de una spec — bugs encontrados revisando el flujo. Criterios de este fix:

- **AC-F1:** el correo lleva el nombre, las iniciales y los colores de la sede del ciclo de la
  clase (Autoescuela Chillán o Conductores Chillán), en el encabezado y en el pie.
- **AC-F2:** si no salió ningún correo (`sent = 0`), la clase **no** queda marcada como enviada y
  la pantalla avisa con un error que no se envió ninguno.
- **AC-F3:** si la función rechaza el envío, la pantalla muestra el motivo que devolvió.
- **AC-F4:** un envío con al menos un correo enviado sigue marcando la clase y avisando como antes
  ("Enlace enviado" o "Envío parcial").

## Cambio

- **Archivo:** `supabase/functions/_shared/zoom-email.ts` (+ test) — `resolveZoomEmailBrand()`:
  nombre, iniciales y tema a partir de `website_config.config.brand`.
- **Archivo:** `supabase/functions/send-zoom-email/index.ts` — lee la marca de la sede del ciclo y
  la usa en el HTML.
- **Archivo:** `src/app/core/facades/ciclos-teoricos.facade.ts` (+ spec) — no estampa con
  `sent = 0`; muestra el mensaje real del error con `edgeFunctionUserMessage()`.

## Test de Regresión

- `src/app/core/facades/ciclos-teoricos.facade.spec.ts` (sent = 0 no estampa; error con motivo).
- `supabase/functions/_shared/zoom-email.test.ts` (marca por sede).

## Progreso

- [x] Tests (rojo 2/8) + cambio en la facade (verde): `ciclos-teoricos.facade.spec.ts` 27/27.
- [x] Marca por sede en la función + test: `zoom-email.test.ts` 10/10, `deno check` limpio.
- [x] Suite completa 298 archivos, `tsc` limpio, `lint:arch` 0 errores (2026-10-23).
- [x] ASG-i-066 (2026-10-23, Ignacio pidió hacerla con ignacio.sorkop@gmail.com): `send-zoom-email`
      desplegada; alumno QA-058 (user 9080) con ese correo y clase 175 (ciclo 30, Autoescuela
      Chillán) con enlace de prueba; envío desde la facade → `{ sent: 1, errors: [] }` y la clase
      quedó marcada. Datos restaurados (correo original, clase sin enlace ni `zoom_sent_at`).
- [x] Ignacio confirmó el correo (captura de Gmail en el celular).
- [x] Cierre.

## Verificación

- 2026-10-23, prueba real (ASG-i-066): el correo llegó a **Recibidos** (no a spam) de
  ignacio.sorkop@gmail.com con encabezado rojo, sello **"AC"** y **"AUTOESCUELA CHILLÁN"** (antes
  "Conductores Chillán" azul), "lunes, 19 de octubre", "Tema: Clase Teórica 1", botón "Unirse por
  Zoom" y el enlace `https://zoom.us/j/0000000000` ✅ (AC-F1). Respuesta de la función
  `{ sent: 1, errors: [] }` y la clase quedó marcada ✅ (AC-F4).
- AC-F2 y AC-F3 cubiertos por `ciclos-teoricos.facade.spec.ts` (27/27): con `sent = 0` no se
  estampa `zoom_sent_at` y aparece "No se envió ningún correo"; un rechazo de la función muestra su
  motivo real.
- `zoom-email.test.ts` 10/10, `deno check` limpio, suite completa 298 archivos, `tsc` limpio,
  `lint:arch` 0 errores.
- Fuera de alcance, para más adelante: el recuadro dice "Fecha y hora" pero solo trae la fecha
  (`class_b_theory_sessions.class_date` es un día, sin hora).
