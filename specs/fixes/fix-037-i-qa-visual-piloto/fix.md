# Fix: QA visual pre-lanzamiento del alcance piloto
> id: fix-037-i-qa-visual-piloto
> refs: ASG-i-012
> status: draft
> created: 2026-09-22

## Root Cause

[Heredado de ASG-i-012, a confirmar]: Antes de entregar el piloto, hay que verificar en
navegador real (no solo lectura de código) todo lo que **queda visible** en el alcance piloto
decidido el 2026-09-15:

- Los 4 portales de Admin y los 4 equivalentes de Secretaria — salvo el recorte de ASG-i-009
  (Clase Profesional reducida a Matrícula + Base de Alumnos).
- Clase B completa, sin recortes.
- Confirmar además que lo ocultado por ASG-i-008/ASG-i-009 **efectivamente no es accesible**
  (no solo que desapareció del menú — probar la URL directa también).

Corre última dentro de la tanda "alcance de lanzamiento piloto — 2026-09-15": depende de que
ASG-i-008, ASG-i-009 y ASG-i-010 ya estén mergeadas (confirmado: las 3 están en "Completadas"
de `specs/ASSIGNMENTS.md` — fix-255-m, fix-256-m).

## ACs Afectados

Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-i-012-qa-visual-pre-lanzamiento-piloto.md`.

## Cambio

Pendiente de completar por quien ejecuta el fix. Alcance sugerido por la Asignación:

- Usar el skill `/verify` (Playwright MCP) contra cada ruta que queda expuesta: consola sin
  errores, sin peticiones 4xx/5xx, sin datos mock, contrato app-like, modo claro/oscuro,
  responsive.
- Recorrer los "recorridos de negocio" del documento "Recorridos de testing — Piloto
  Admin/Secretaria" (enviado al equipo 2026-09-14, no versionado en el repo — pedirlo antes de
  ejecutar) — no basta con que cada pantalla cargue, hay que completar los flujos reales
  (matricular, iniciar/finalizar clase, pagar, cerrar caja, etc.) al menos una vez con cuentas
  de prueba.
- Probar explícitamente entrar por URL directa a una ruta oculta (`/app/instructor/dashboard`,
  `/app/admin/clase-profesional/promociones`, etc.) logueado como admin/secretaria — debe caer
  en la pantalla de aviso de ASG-i-010, no en un error genérico ni, peor, renderizar el módulo.

Fuera de alcance (heredado de la Asignación): no es una auditoría de código — es verificación
de comportamiento real en navegador. No cubre Instructor/Alumno (fuera del alcance de esta
entrega).

## Test de Regresión

Pendiente de completar — al ser un fix de verificación (no de código), la "regresión" es la
evidencia de `/verify` por ruta + captura de los recorridos de negocio completados, documentada
en la sección de Evidencia al cerrar.

## Evidencia de Verificación

Pendiente.
