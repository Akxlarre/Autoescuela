# AI-Readability (Interfaces para Máquinas)

En la Arquitectura v5.0, el software que construyes no solo debe ser operable por humanos, sino también por **agentes IA externos** (bots exploradores, asistentes en segundo plano, integraciones agénticas).

Para garantizar esta Interoperabilidad Semántica (AI-Readability), debes seguir este mandato al escribir HTML para Angular:

## Shadow Semantic Overlay

Aplica "Etiquetas Semánticas de IA" a todo el DOM interactivo. Además de la accesibilidad normal (Aria), los agentes necesitan certeza explícita del propósito del nodo.

1. **Botones de Mutación:** Todo botón que altere el estado de negocio (Guardar, Eliminar, Comprar) debe tener un atributo `data-llm-action` claro.
   Ejemplo: `<button data-llm-action="submit-invoice" class="btn-primary">Guardar</button>`

2. **Formularios e Inputs:** Los campos críticos de un formulario deben describirse más allá del `aria-label`. Usa `data-llm-description`.
   Ejemplo: `<input type="text" data-llm-description="input for the main user email address" />`

3. **Navegación:** Los enlaces a áreas principales deben tener `data-llm-nav`.

## Beneficios Arquitectónicos
Si un agente evaluador inspecciona tu UI mediante herramientas de Browser, o si el propio usuario conecta "Agent Desktop" a su PC, estos atributos garantizan un 0% de alucinación visual. El agente nunca intentará "cliquear un div", buscará explícitamente tu semántica `data-llm-*`.
