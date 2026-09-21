# Asignación ASG-m-006 — Fix visual en la vista Secretarias de admin (espacio vacío)

> **status:** completada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** m
> **claimed_at:** 2026-09-15
> **resulting_track:** fix-247-m-secretarias-layout-espacio-vacio

---

## Contexto / Objetivo

La vista Secretarias de admin tiene un problema visual: algunos elementos se corrieron de
lugar y quedó mucho espacio vacío. Hay que revisar y corregir el layout para que se vea
correctamente.

## Alcance sugerido

- Auditar visualmente la vista con Playwright (`/verify`) antes y después del fix.
- Corregir el layout siguiendo las reglas del sistema visual del proyecto (Bento Grid,
  tokens semánticos, etc. — ver `.claude/rules/visual-system.md`).

## Referencias

- Ninguna.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado. Probablemente el componente de la vista Secretarias en `features/admin/`.

## Notas para quien la reclame

- Tarea acotada — buena candidata para un fix track simple. Confirmar visualmente con
  screenshots antes de dar por cerrado (ver `feedback_css_fit_without_visual_tools` en
  memoria del proyecto: no ajustar CSS de fit a ciegas sin Playwright).
