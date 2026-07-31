# Fix: Fase 5 QA visual restante — skeletons, capturas, regla 3-2-1
> id: fix-071-b-fase-5-qa-visual-restante
> refs: ASG-b-001
> status: in_progress
> created: 2026-07-31

## Root Cause
[Heredado de ASG-b-001, a confirmar]: las iteraciones 19-21 de la Fase 5 del audit
(`indices/FLOWS-QA-AUDIT.md`) requerían navegador real (Playwright) y quedaron
bloqueadas a mitad de sesión porque el clasificador de seguridad quedó temporalmente
no disponible. El audit original solo capturó evidencia real (Playwright) de Dashboard
y Base Alumnos B — el resto de las ~26 páginas nunca se verificó con navegador, solo
por lectura de código. Tres cosas quedaron sin confirmar con evidencia real:

1. Que los skeletons de carga (`<app-skeleton-block>`) aparecen de verdad en estados de
   red lenta, no solo que el código los referencia.
2. Cómo se ve realmente el resto de las páginas sin capturas.
3. Que la regla 3-2-1 de marca (`var(--ds-brand)` máx 3 elementos/viewport) se respeta
   fuera del Dashboard.

Ampliación de la reunión con el cliente (2026-07-28): en Instructores y Alumnos se
reportó que algunas vistas siguen usando el hero azul antiguo en vez del
`app-section-hero` canónico — se absorbe acá por ser el mismo tipo de hallazgo de
consistencia visual.

## ACs Afectados
Ninguno — fix autónomo de QA visual, no corrige un AC de una spec puntual. Referencia:
`indices/FLOWS-QA-AUDIT.md` Fase 5 (iteraciones 19-21) y `indices/UI-HOMOGENEITY-AUDIT.md`
(patrón "hero en `bento-banner` vs `bento-hero`").

## Cambio
<!-- A completar durante la ejecución: páginas verificadas, skeletons confirmados,
     conteo de var(--ds-brand) por página, vistas de Instructores/Alumnos migradas
     al hero canónico. -->
- **Archivo:** (pendiente — cobertura QA visual transversal, no un archivo puntual)
- **Qué cambia:** ...

## Test de Regresión
<!-- Capturas Playwright (claro/oscuro/mobile) de: Agenda, Pagos, Matrícula, Asistencia B,
     Base Alumnos Prof., Instructores — como evidencia, no como test automatizado. -->
- Pendiente
