# Asignación ASG-023 — Decisión de producto + fix H-021: límite de clases/día distinto público vs interno

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

El wizard público de matrícula (`/inscripcion`) limita a "Máximo 1 clase por día" al agendar las 12 prácticas, mientras el wizard interno (secretaria/admin) permite "hasta 3 clases por día". Ambos límites se respetan correctamente dentro de su propio flujo, pero son **reglas de negocio distintas para la misma operación** — dos alumnos con el mismo curso pueden terminar con densidades de agenda muy distintas (mínimo 12 días hábiles vs. mínimo 4) según por qué puerta entraron.

## Alcance sugerido

- **Primero, una decisión de producto**: ¿es intencional que el wizard público sea más restrictivo (quizás para evitar que un alumno se sature de clases seguidas sin supervisión de una secretaria)? Si es intencional, documentarlo explícitamente en el código y en `docs/PRODUCT-VISION.md` o similar. Si NO es intencional, unificar la regla.
- Una vez decidido, el cambio de código (si aplica) es acotado: ajustar el límite en uno de los dos wizards para que coincidan.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-021.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado — es una decisión de producto primero; el archivo a tocar depende de qué se decida (wizard público vs. wizard interno).

## Notas para quien la reclame

- Este es más una conversación de producto que un bug — no asumir cuál de los dos límites es "el correcto" sin preguntar al owner primero.
