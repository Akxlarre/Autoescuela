# Asignación ASG-020 — Fix H-004 + H-005: formato financiero (enum crudo + separador de miles)

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

2 hallazgos de formato en módulos financieros:
- **H-004**: en Anticipos (`/app/admin/contabilidad/anticipos`), la columna TIPO muestra el enum crudo `both` para algunos instructores en vez de "Teórico y Práctico" (mismo valor, mapeo incompleto).
- **H-005**: los KPIs grandes de Reportes (`$ 180000`) y Cursos Singulares (`$220000`) omiten el separador de miles, mientras las tablas de las mismas páginas sí lo usan (`$180.000`). Además, en Reportes aparece una categoría "Otros (Sede 0)" — nombre de sede sin resolver, cae al id crudo.

## Alcance sugerido

- H-004: completar el mapeo BD→UI del enum de tipo de instructor en la tabla "Cuenta Corriente por Instructor".
- H-005: usar el mismo pipe/formato de `Intl` que ya usan las tablas de esas páginas para los KPIs grandes también.
- H-005 (sede "Otros"): investigar por qué el resolver de nombre de sede cae a un fallback con id crudo — puede compartir causa raíz con H-013 (branch_id no resoluble), vale la pena comparar antes de arreglar por separado.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgos H-004 y H-005.

## Notas para quien la reclame

- Ambos son fixes de formato/copy, bajo riesgo, sin lógica de negocio involucrada — buen paquete para alguien nuevo en el repo.
