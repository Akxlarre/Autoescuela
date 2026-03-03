# Sistema de Modelos (`core/models/`)

Las reglas arquitectónicas estrictas sobre cómo gestionar los modelos, interfaces y tipos de la aplicación han sido integradas formalmente en el sistema de reglas de nuestro agente auxiliar.

Para referencia del equipo humano y los agentes de IA, por favor consultar:

- **Reglas del Sistema (Restricciones y Patrones)**: `.claude/rules/models.md`
- **Índice Oficial de Modelos (Domain vs UI)**: `indices/MODELS.md`

Todo nuevo modelo debe alinearse a la separación estricta entre **Domain** (tablas BD) y **UI** (estructuras puramente de presentación o vistas). No agregar modelos en la raíz de `core/models/`.
