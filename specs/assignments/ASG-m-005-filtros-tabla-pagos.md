# Asignación ASG-m-005 — Filtros en la tabla principal de la vista Pagos

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

La tabla principal de la vista Pagos no tiene ningún filtro actualmente. Se necesita agregar
filtros útiles, por ejemplo por rango de fechas y por tipo de curso (B o Profesional), u
otros que se consideren útiles al revisar la tabla.

## Alcance sugerido

- Filtro de rango de fechas.
- Filtro por tipo de curso (B / Profesional).
- Evaluar si conviene también filtro por estado de pago (pagado/pendiente) o por sede, si
  ya existen esos datos en la tabla.

## Referencias

- Ninguna.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado. Probablemente toca el componente de tabla de la vista Pagos y su
  Facade correspondiente.

## Notas para quien la reclame

- Tarea acotada — buena candidata para un fix track simple.
