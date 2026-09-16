# Asignación ASG-i-012 — QA visual pre-lanzamiento del alcance piloto

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-15
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Antes de entregar, verificar en navegador real (no solo lectura de código) todo lo que
**queda visible** en el alcance piloto decidido el 2026-09-15:

- Los 4 portales de Admin y los 4 equivalentes de Secretaria... salvo el recorte de
  ASG-i-009 (Clase Profesional reducida a Matrícula + Base de Alumnos).
- Clase B completa, sin recortes.
- Confirmar además que lo ocultado por ASG-i-008/ASG-i-009 **efectivamente no es accesible**
  (no solo que desapareció del menú — probar la URL directa también).

## Alcance sugerido

- Usar el skill `/verify` (Playwright MCP) contra cada ruta que queda expuesta: consola sin
  errores, sin peticiones 4xx/5xx, sin datos mock, contrato app-like, modo claro/oscuro,
  responsive.
- Recorrer además los "recorridos de negocio" ya definidos en el documento de recorridos de
  testing (ver referencia) — no basta con que cada pantalla cargue, hay que completar los
  flujos reales (matricular, iniciar/finalizar clase, pagar, cerrar caja, etc.) al menos una
  vez con las cuentas de prueba.
- Probar explícitamente entrar por URL directa a una ruta oculta (`/app/instructor/dashboard`,
  `/app/admin/clase-profesional/promociones`, etc.) logueado como admin/secretaria — debe caer
  en la pantalla de aviso de ASG-i-010, no en un error genérico ni, peor, renderizar el módulo.

## Fuera de alcance

- No es una auditoría de código — es verificación de comportamiento real en navegador.
- No cubre Instructor/Alumno (están fuera del alcance de esta entrega).

## Referencias

- Documento "Recorridos de testing — Piloto Admin/Secretaria" (archivo enviado al equipo,
  2026-09-14) — los 3 bloques de recorridos (Alumnos/Matrícula, Operación diaria, Dinero y
  Administración) son la base de este QA.
- `.claude/skills/verify/SKILL.md`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio — toca todo lo que ASG-i-008/009/010 modifiquen, por eso debe ir **después**.

## Notas para quien la reclame

- Depende de que ASG-i-008, ASG-i-009 y ASG-i-010 ya estén mergeadas — no tiene sentido
  correrla antes.
- Es la última asignación de la tanda antes de dar por lista la entrega piloto.
