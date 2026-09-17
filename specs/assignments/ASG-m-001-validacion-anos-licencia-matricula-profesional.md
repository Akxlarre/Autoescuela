# Asignación ASG-m-001 — Validación de años de licencia previa en matrícula profesional

> **status:** completada
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-14
> **created_by:** m
> **claimed_by:** i
> **claimed_at:** 2026-09-17
> **resulting_track:** fix-033-i-validacion-anos-licencia-clase-profesional

---

## Contexto / Objetivo

En los flujos de matrícula profesional, la sección donde se pide la licencia actual del
potencial alumno necesita más validaciones sobre la antigüedad de esa licencia, según la
clase profesional a la que se está matriculando:

- A2, A4 y Conv. A4 → requieren **2 años** de licencia clase B.
- A5, A3 y Conv. A5 → requieren **2 años** de licencia A2 o A4.

Hoy el flujo no valida esta antigüedad, lo que permite matricular a alumnos que no cumplen
el requisito legal/reglamentario de tiempo mínimo con la licencia previa.

## Alcance sugerido

- Agregar la validación de antigüedad (fecha de obtención de la licencia actual vs. hoy)
  según la clase objetivo, en el paso de matrícula profesional donde se ingresa la licencia.
- Definir claramente el mensaje de bloqueo/advertencia cuando no se cumple el requisito.
- Cubrir tanto el flujo que usa la secretaria como cualquier flujo online/autoservicio si
  existe uno equivalente.

## Referencias

- Ninguna.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado.

## Notas para quien la reclame

- Confirmar con el dueño el comportamiento exacto si la fecha de obtención de la licencia
  actual no está registrada en el sistema (¿bloquea, advierte, o permite continuar bajo
  responsabilidad de la secretaria?).
- Confirmar si esta validación debe ser dura (bloqueante) o una advertencia que se puede
  pasar por alto con justificación.
