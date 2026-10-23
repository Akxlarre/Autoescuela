# Asignación ASG-i-066 — Prueba real del correo del Zoom (cierra fix-062-i)

> **status:** completada
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-10-23
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-10-23
> **resulting_track:** fix-062-i-correo-zoom-sede-y-envio-fallido

---

## Contexto / Objetivo

`fix-062-i` dejó listo en el código que el correo del Zoom de las clases teóricas Clase B lleve el
nombre, las iniciales y los colores de la sede (antes decía siempre "Conductores Chillán"), que un
envío sin ningún correo enviado no marque la clase como enviada, y que la pantalla muestre el motivo
cuando la función rechaza el envío. Falta desplegar la función y comprobar que el correo **llega**
y se ve bien. El agente no puede disparar el envío solo: tiene que cambiar el correo de un alumno
de prueba en datos reales.

## Pasos (≈10 minutos)

1. Pedirle a Claude que despliegue `send-zoom-email`
   (`npx supabase functions deploy send-zoom-email`). Es compatible con el front publicado.
2. En el SQL Editor de Supabase — el alumno de prueba QA-058 (único del ciclo del 19 de octubre en
   Autoescuela Chillán) pasa a tener tu correo, y la clase 1 de ese ciclo un enlace de prueba:
   ```sql
   UPDATE public.users SET email = 'ig.sorko@duocuc.cl'
   WHERE id = (SELECT s.user_id FROM public.students s JOIN public.enrollments e ON e.student_id = s.id WHERE e.id = 8495);
   UPDATE public.class_b_theory_sessions SET zoom_link = 'https://zoom.us/j/0000000000' WHERE id = 175;
   ```
3. En la app como admin: **Asistencia B → Ciclos teóricos → "Ciclo — Lunes 19 de octubre ·
   Autoescuela Chillán"** → clase 1 → enviar el Zoom a "Claseb Prueba QA Cincuentaiocho".
4. Revisar ig.sorko@duocuc.cl (también spam): debe decir **"Autoescuela Chillán"**, sello **"AC"**,
   colores de esa sede, fecha y tema de la clase, y el botón "Unirse por Zoom" con el enlace.
5. Dejar todo como estaba:
   ```sql
   UPDATE public.users SET email = 'qa058.claseb@test-data.local'
   WHERE id = (SELECT s.user_id FROM public.students s JOIN public.enrollments e ON e.student_id = s.id WHERE e.id = 8495);
   UPDATE public.class_b_theory_sessions SET zoom_link = NULL, zoom_sent_at = NULL WHERE id = 175;
   ```
6. Contarle a Claude cómo llegó → anota la verificación y cierra `fix-062-i`.

## Si algo falla

- No llega nada y la pantalla dice "No se envió ningún correo": el servidor de correo (secrets
  `SMTP_*`) rechazó el envío — revisar los logs de `send-zoom-email` en Supabase.
- Llega con "Autoescuela" a secas: la sede no tiene `website_config.config.brand.name`.
- Si el alumno QA-058 ya no está en ese ciclo (o los IDs cambiaron), elegir otro alumno de prueba
  que esté solo en un ciclo; nunca enviar a un ciclo con alumnos reales.

## Referencias

- `specs/fixes/fix-062-i-correo-zoom-sede-y-envio-fallido/fix.md`
- `supabase/functions/send-zoom-email/index.ts`, `supabase/functions/_shared/zoom-email.ts`
