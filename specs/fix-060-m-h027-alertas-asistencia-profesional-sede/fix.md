# Fix: 500 real en alertas de asistencia Profesional al filtrar por sede

> id: fix-060-m-h027-alertas-asistencia-profesional-sede
> refs: ASG-015
> status: in-progress
> created: 2026-07-23

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
[Heredado de ASG-015, a confirmar]: Las queries `checkYellowAttendance`/`checkRedAttendance` (`dashboard-alerts.facade.ts`) contra la vista `v_professional_attendance` devuelven **500 Internal Server Error** real (no un simple 400/403) cuando se filtra por una sede específica no nula. Confirmado que con `branchId=null` (admin en "Todas las sedes") las mismas queries responden `200 OK` con datos correctos. Las alertas de asistencia crítica/en riesgo de Clase Profesional nunca se calculan para ninguna secretaria con acceso a Profesional, sin avisar del fallo. El error sugiere un JOIN o cast de tipo mal formado específicamente en la rama que filtra por sede, dentro de la definición SQL de `v_professional_attendance`.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo (hallazgo de QA manual, H-027 en `indices/FLOWS-QA-AUDIT.md`)

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- Pendiente de investigación.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Pendiente. Verificar en vivo con `secretaria2@test.com` (sede CON Profesional) tras el fix — debería ver las mismas alertas que ve el admin filtrando a esa sede.
