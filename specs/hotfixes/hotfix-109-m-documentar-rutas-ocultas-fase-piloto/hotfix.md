# Hotfix: Documentar en ROUTES.md que las rutas con pilotPhaseGuard están ocultas por fase, no muertas

> id: hotfix-109-m
> refs: ASG-i-011
> status: done
> closed: 2026-09-21
> created: 2026-09-21

## Problema

`indices/ROUTES.md` es auto-generado desde `app.routes.ts` (`npm run indices:sync`) y quedó
desactualizado tras fix-255-m/fix-256-m/fix-257-m: no refleja los `pilotPhaseGuard(...)`
agregados a las rutas de Instructor, Alumno, matrícula pública y los 7 módulos recortados de
Clase Profesional. Sin una nota explícita, el próximo agente que audite el índice puede leer
esas rutas como candidatas a borrar en vez de "ocultas temporalmente por decisión de alcance
del piloto".

## Cambios

- **Archivo:** `indices/ROUTES.md` — correr `npm run indices:sync` para regenerar el bloque
  `AUTO-GENERATED` (trae los `pilotPhaseGuard(...)` ya presentes en `app.routes.ts`) y agregar
  una nota manual (fuera del bloque auto-generado) explicando el significado de
  `pilotPhaseGuard('instructor'|'alumno'|'inscripcion-publica'|'clase-profesional-recorte')`
  y linkeando a fix-255-m/fix-256-m/fix-257-m.
