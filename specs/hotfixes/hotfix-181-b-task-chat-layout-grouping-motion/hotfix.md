# Hotfix: pulido fino del chat de tareas (agrupación, espaciado, animación y avatares)
> id: hotfix-181-b-task-chat-layout-grouping-motion
> refs: —
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Problema
1. Redundancia en avatar del usuario: el círculo muestra "Tú" y la etiqueta repite "Tú" (`[Tú] Tú · hace 0m`). Debe mostrar las iniciales reales del usuario en el avatar.
2. Mensajes consecutivos no agrupados: cuando un usuario envía varios mensajes seguidos, se repite la cabecera completa (avatar, nombre, fecha) para cada mensaje, generando ruido visual.
3. Burbujas con ancho forzado y sangría: mensajes cortos (`q`, `qw`) se expandían en bloques con sangría `pl-6.5` en vez de ajustar su tamaño al contenido (`w-fit`).
4. Espaciado excesivo en la caja de respuesta: el textarea tenía un alto rígido de 64px, divisor innecesario y botones desproporcionados. Requiere un compositor compacto tipo mensajería moderna con auto-expansión vertical.
5. Falta de animación de entrada: los nuevos mensajes aparecían abruptamente. Requiere `appAnimateIn` y scroll suave automático.

## Cambios
1. `src/app/shared/components/task-reply-thread/task-reply-thread.component.ts`:
   - Agrupar mensajes consecutivos del mismo emisor enviados en ventana de 5 minutos (ocultar cabecera redundante en los siguientes).
   - Generar iniciales reales para el avatar mediante `getInitialsFromDisplayName`.
   - Reducir burbujas a `w-fit max-w-[85%]` sin sangría forzada.
   - Reemplazar textarea rígido por compositor compacto con auto-crecimiento en altura y botón de envío integrado.
   - Integrar `AnimateInDirective` para entrada suave de mensajes y scroll automático suave hacia el fondo.
2. `src/app/features/tareas/task-detail-modal.component.ts`:
   - Pasar `currentUserName` al componente del hilo.
   - Compactar paddings de las tarjetas superiores para otorgar mayor balance visual a la conversación.
