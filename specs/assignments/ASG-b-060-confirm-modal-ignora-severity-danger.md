# Asignación ASG-b-060 — El CTA de `ConfirmModalService` ignora `severity: 'danger'` y sale en azul de marca

> **status:** reclamada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-08-01
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-01
> **resulting_track:** fix-094-b-confirm-modal-severity-cta

---

## Contexto / Objetivo

`ConfirmModalService.confirm({ severity: 'danger' })` pinta el ícono en rojo pero deja el
**botón de confirmación en el azul de marca** — el mismo color que usa cualquier CTA positivo
de la app ("Guardar", "Actualizar"). Detectado en la verificación visual de `fix-093-b`, al
agregar la confirmación de "Eliminar horario" en el rail de alertas de Asistencia B: el modal
avisa que se cancelarán todas las clases de un alumno, y el botón que lo ejecuta se ve idéntico
a uno de guardar.

Es **transversal**: afecta a toda confirmación destructiva de la app, no a una pantalla. El
riesgo real es el clic por inercia — el usuario aprende que "el botón azul de la derecha es el
que confirma" y deja de leer el mensaje.

## Alcance sugerido

- Hacer que `severity: 'danger'` mande sobre el estilo del CTA, no solo sobre el ícono. El DS
  ya tiene `btn-danger-solid` (`src/tailwind.css:352`) descrito literalmente como "acción
  destructiva principal (ej: confirmar archivado)" — es el candidato natural, no hay que
  inventar estilo nuevo.
- Revisar el resto de severidades (`info` / `warn` / `success` / `secondary`): si `danger` no
  se estaba aplicando al botón, es probable que ninguna lo haga. Confirmar antes de asumir.
- **Barrido de llamadas existentes:** hay que ver cuántos `confirm()` en la app ya pasan
  `severity: 'danger'` esperando el estilo rojo. Todos cambian de aspecto de golpe con este
  fix — es el efecto buscado, pero conviene saber el alcance antes de mergear, no después.
- Verificar contraste en claro y oscuro con `/verify` (el probe de `getComputedStyle` sobre el
  botón del modal, igual que se hizo en `fix-093-b`).

## Referencias

- `fix-093-b-boton-recordar-alertas-asistencia-b` — donde se detectó; su sección "Verificación
  visual" tiene el método de medición de contraste en runtime.
- `src/tailwind.css:319` (`btn-danger-ghost`) y `:352` (`btn-danger-solid`) — el DS ya resuelve
  esto, igual que resolvió el ajuste de "Eliminar" en fix-093-b con una línea.
- `docs/BACKLOG-DEUDA-TECNICA.md` — fase 5 (botones).

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/services/ui/confirm-modal.service.ts`
- El componente de modal que renderiza la confirmación (localizarlo desde el service — no lo
  verifiqué al redactar esto, no asumir la ruta)
- Consumidores que pasan `severity: 'danger'` (barrido pendiente, ver Alcance)

## Notas para quien la reclame

- **Por qué P1 pese a ser "cosmético":** no es estética, es prevención de error destructivo. El
  color es la única señal que distingue confirmar de cancelar cuando alguien no lee el texto.
- Mismo patrón que `fix-093-b`: **antes de escribir estilos nuevos, revisar si el DS ya tiene la
  clase**. En ese fix la corrección terminó siendo cambiar una clase por otra que ya existía.
- Ojo con el orden de los botones del modal (hoy Cancelar a la izquierda, confirmar a la
  derecha). Si se toca, es decisión de diseño aparte — no meterla de contrabando en este fix.
