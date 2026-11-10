# Hotfix: optimización mobile del compositor de chat en tareas
> id: hotfix-183-b-task-chat-mobile-composer-ux
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
En pantallas reducidas / móviles (ej: iPhone 16 viewport 393px):
1. El placeholder "Escribe una respuesta… (Ctrl+Enter para enviar)" es demasiado largo y se corta en dos líneas; en móviles el atajo "Ctrl+Enter" no existe.
2. El botón de envío incluye el texto "Enviar" junto al ícono, consumiendo ancho horizontal innecesario y comprimiendo el textarea.
3. El contenedor no adapta su padding ni altura mínima para toques táctiles móviles (tap area).

## Cambios
1. `src/app/shared/components/task-reply-thread/task-reply-thread.component.ts`:
   - Simplificar el placeholder a "Escribe una respuesta…" (sin sufijo de atajo en placeholder).
   - En mobile: botón de envío cuadrado/circular de solo ícono (`w-9 h-9`, ocultando la etiqueta "Enviar" con `hidden sm:inline`).
   - Mantener el hint de `Ctrl+Enter` solo visible en desktop o como tooltip accesible.
   - Ajustar el padding del contenedor para maximizar el área útil del textarea en pantallas pequeñas.
