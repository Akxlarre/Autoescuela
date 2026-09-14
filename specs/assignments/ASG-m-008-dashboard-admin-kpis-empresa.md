# Asignación ASG-m-008 — Rediseño del Dashboard de admin como KPIs/reportes de empresa

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

El Dashboard de admin (solo admin, no secretaria) debe dejar de tener acciones tipo
secretaria y en su lugar mostrar datos de la empresa útiles: reportes, KPIs, comparaciones
de métricas respecto al año pasado, etc. La secretaria mantiene su propio dashboard actual
sin cambios — este rediseño es solo para la vista de admin.

Los KPIs y datos a mostrar deben sacarse del dashboard que está en la página mock de Jorge
Pérez — ese mock es la referencia de qué métricas debe tener este nuevo dashboard de admin.

## Alcance sugerido

- Dashboard de admin separado/diferenciado del de secretaria (si hoy comparten componente,
  hay que evaluar si conviene dividirlos).
- KPIs y reportes de negocio (según el mock de Jorge Pérez), con comparación año actual vs.
  año anterior donde aplique.
- Mantener el dashboard de secretaria intacto — el cambio es exclusivo de la vista admin.

## Referencias

- Página mock de "Jorge Pérez" — ahí están los KPIs y datos de referencia que debe mostrar
  este nuevo dashboard.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado. Probablemente toca el Dashboard actual en `features/admin/` y su
  Facade (`DashboardFacade`), y requiere localizar primero la página mock de Jorge Pérez
  mencionada como referencia.

## Notas para quien la reclame

- Antes de plantear el plan, localizar y revisar la página mock de Jorge Pérez para extraer
  la lista concreta de KPIs/reportes esperados.
