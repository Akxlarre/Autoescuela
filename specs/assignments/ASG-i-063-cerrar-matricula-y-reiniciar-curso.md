# Asignación ASG-i-063 — Cerrar una matrícula y reiniciar el curso (Clase B)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-10-15
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Hoy no hay forma de cerrar a mano una matrícula en curso ni de perdonar su saldo, y la regla de
rematrícula (`evaluateReenrollment`, fix-020) bloquea una matrícula nueva en el mismo curso mientras
la anterior siga activa. Caso real: un alumno que dejó de venir (con o sin deuda, por ejemplo en la
clase 10) y prefiere empezar de cero pagando todo. No hay plazo que lo obligue a reiniciar: lo
normal es volver y reagendar en la misma matrícula ("Reagendar clases penalizadas", RF-053). Esta
asignación es para el caso en que el alumno elige reiniciar. **Decisión de negocio a conversar con
el equipo antes de escribir la spec.**

## Alcance sugerido

Propuesta conversada con Ignacio (2026-10-15), a confirmar:
- Cerrar la matrícula vieja (pasa a `cancelled`) con **motivo obligatorio** y cancelar sus clases
  futuras. Con eso la regla de rematrícula ya permite la nueva (pide confirmación).
- Si tiene deuda, quien la cierra **elige**:
  - **Perdonarla:** deja de contar como "por cobrar", con registro de quién, cuándo y por qué.
  - **Mantenerla:** la matrícula queda cerrada y la deuda sigue en deudores para cobrarla después
    (tiene sentido si tomó clases sin pagarlas, p.ej. habilitado sin pago en la clase 7).
- Lo ya pagado **no se devuelve ni se descuenta automáticamente** (pagó las clases que tomó). Si el
  dueño quiere reconocerle algo, usa un descuento en la matrícula nueva.
- **Pregunta abierta: ¿solo el admin o también la secretaria?** El admin es el dueño de la escuela,
  no está siempre en el local (trabajan él y 2 secretarias), y la secretaria tiene al alumno
  enfrente. Opción intermedia sugerida: la secretaria puede hacerlo, con motivo obligatorio, y el
  admin recibe una notificación de cada cierre y de cada deuda perdonada.
- Fuera de alcance probable: devoluciones de dinero; Clase Profesional (requiere licencia B con
  2 años, flujo distinto).

## Referencias

- `fix-048-i-testing-pagos-y-descuentos` (B2-1): una matrícula cerrada con deuda + la nueva
  aparecen como 2 filas del mismo alumno en Pagos; el fix de B2-1 muestra N°, curso y estado.
- `fix-020` (regla de rematrícula), `hotfix-150-m` (se eliminó la regla vieja que cancelaba la
  matrícula con 2 faltas), RF-053 (reagendar clases penalizadas), spec `0010-i` (clase 7 bloqueada
  sin segundo pago; "Habilitar sin pago").

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/utils/reenrollment.utils.ts`
- `src/app/core/facades/admin-alumno-detalle.facade.ts`
- `src/app/core/facades/pagos.facade.ts`

## Notas para quien la reclame

- Perdonar deuda cambia lo que la escuela tiene por cobrar: tiene que quedar en `audit_log` y
  reflejarse en Reportes / Dashboard ejecutivo (no seguir sumando como deuda).
- La validación de quién puede cerrar/perdonar debe vivir en la BD (RPC), no solo en la UI.
