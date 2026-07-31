# Fix: Configuración Web usa voseo argentino
> id: fix-002-i-voseo-configuracion-web
> refs: ASG-b-021
> status: done
> closed: 2026-07-30
> created: 2026-07-29

## Root Cause
[Heredado de ASG-b-021, a confirmar]: La sección Configuración Web usa voseo argentino ("Seleccioná una sede…", "Usá el selector…", "querés editar") mientras el resto de la app usa español de Chile (tuteo). Inconsistencia de tono en una pantalla completa. También se confirmó en el audit (Fase 3, iteración 12) que el voseo se filtró a textos de sistema generados por triggers/Edge Functions, no solo a la UI estática — revisar ambos.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **Archivo:** `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts` — "Seleccioná una sede en el menú superior" → "Selecciona una sede en el menú superior"; "Usá el selector de sede del topbar para elegir qué configuración web querés editar." → "Usa el selector de sede del topbar para elegir qué configuración web quieres editar."
- **Archivo:** `src/app/features/admin/configuracion-web/tabs/cursos-tab.component.ts` — "Primero creá cursos en el Catálogo Operacional..." → "Primero crea cursos en el Catálogo Operacional..."
- Barrido de los otros 5 tabs (`hero-tab`, `general-tab`, `promo-tab`, `contacto-tab`, `faqs-tab`) con regex amplia de formas de voseo (verbos `-ás`/`-és`/`-ís`, imperativos, pronombre `vos`) — sin coincidencias adicionales, solo las 3 anteriores.
- **Archivo nuevo:** `supabase/migrations/20260729000000_fix_h006_voseo_website_config_notification.sql` — la migración histórica `20260523000000_refactor_website_config_courses_fk.sql` (Spec 0004, ya aplicada) insertó una notificación in-app con voseo ("Reconfigurá las cards de tu landing..."). No se edita la migración ya aplicada (regla del proyecto) — se agregó una migración nueva idempotente (`UPDATE ... WHERE subject = '<texto viejo>'`) que corrige el dato ya insertado. Es la única instancia server-side encontrada; no hay Edge Functions relacionadas a Configuración Web con texto en español.

## Test de Regresión
- Copy puro sin lógica de decisión — no se agregaron tests automatizados (no aplica según `.claude/rules/testing-tdd.md`, no hay `computed()` ni ramas de decisión involucradas).
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` sin hallazgos nuevos en los archivos tocados.
- Verificación manual pendiente: correr la migración nueva contra la base y confirmar visualmente en `/app/admin/configuracion-web` (sin sede seleccionada) que el copy quedó en tuteo.
