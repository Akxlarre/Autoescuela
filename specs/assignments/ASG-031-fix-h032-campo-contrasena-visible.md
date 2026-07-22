# Asignación ASG-031 — Fix H-032: campo Contraseña visible en "Recuperar Contraseña"

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

En `/login` → "¿Olvidaste tu contraseña?", el formulario cambia el título a "Recuperar Contraseña" y el texto a "Ingresa tu correo para recibir un enlace", pero el campo "Contraseña" del login normal sigue visible (con el valor anterior aún cargado). El envío del enlace de recuperación SÍ funciona correctamente — el campo de contraseña simplemente no se oculta ni se limpia al cambiar de modo.

## Alcance sugerido

- Ocultar (o remover del DOM) el campo "Contraseña" cuando el formulario está en modo "Recuperar Contraseña", y limpiar su valor al volver al modo login normal.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-032.

## Notas para quien la reclame

- Fix muy acotado, un solo componente (login/recuperar contraseña) — buen candidato rápido.
