# Asignación ASG-001 — Fase 5 QA visual restante: skeletons, capturas, regla 3-2-1

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Las iteraciones 19-21 de la Fase 5 del audit (`indices/FLOWS-QA-AUDIT.md`) requerían navegador real (Playwright) y quedaron bloqueadas a mitad de sesión porque el clasificador de seguridad quedó temporalmente no disponible. Objetivo: verificar 3 cosas que el audit original nunca confirmó con evidencia real — (1) que los skeletons de carga aparecen de verdad en estados de red lenta, no solo que el código los referencia; (2) cómo se ve realmente el resto de las ~26 páginas sin capturas (el audit solo capturó Dashboard y Base Alumnos B); (3) que la regla 3-2-1 de marca se respeta en esas páginas, no solo en el Dashboard.

## Alcance sugerido

- Interceptar/throttlear la red (Playwright `route()` o CDP) en 3-4 páginas con carga de datos (Dashboard, Agenda, Libro de Clases) y confirmar visualmente que aparece `<app-skeleton-block>` en vez de contenido en blanco.
- Capturas reales (`browser_take_screenshot`) claro/oscuro/mobile de páginas priorizadas: Agenda, Pagos, Matrícula, Asistencia B, Base Alumnos Prof., Instructores.
- Contar usos de `var(--ds-brand)` por viewport en esas mismas páginas (máx 3: 2 interactivos + 1 decorativo).
- Fuera de scope: no es necesario cubrir las 30 páginas completas — priorizar las de mayor tráfico.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, iteraciones 19-21 (Fase 5), y la iteración 14 (Fase 3) que ya cubrió Dashboard/Base Alumnos B como referencia de método.
- `.claude/rules/swr-pattern.md`, `.claude/rules/visual-system.md`.

## Notas para quien la reclame

- Reservada para Benjamín porque requiere el entorno de navegador local — si alguien más quiere tomarla, coordinar primero.
- Coordinar con **ASG-022** (fix de skeletons en Agenda/Libro de Clases, H-007) — esta asignación es la verificación, ASG-022 es el fix del bug ya confirmado. No dupliquen el diagnóstico.
