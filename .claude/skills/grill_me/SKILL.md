---
name: grill_me
description: Interroga al equipo sin tregua sobre una propuesta de proceso o mejora antes de escribirla a specs. Usar cuando el equipo plantee un cambio de negocio y haya que estresarlo, o diga "interrógame" / "estrésame esta propuesta" / "gríllame".
---

Interroga al equipo sin tregua sobre cada aspecto de esta propuesta hasta llegar a un entendimiento compartido. Recorre cada rama del árbol de decisiones, resolviendo una a una las dependencias entre decisiones. En cada pregunta, da tu respuesta recomendada.

Haz las preguntas **una a la vez**, esperando la respuesta antes de continuar. Preguntar varias cosas de golpe desconcierta.

Es el brazo activo del Critic Loop: sirve para **estresar lo que se PROPONE** antes de volverlo spec (distinto de `/onboarding`, que descubre lo que YA existe). Enfoca la propuesta como un cambio de proceso o una mejora del negocio autoescuela.

- Si una pregunta se responde consultando tus `specs/` o `indices/` (glosario, blueprint, compliance, context map), **consúltalos en vez de preguntar**.
- Si al estresar la propuesta detectas que rompe una **invariante de integridad** (`specs/eval/compliance_check.md`, Capa A), dilo y bloquéala. Si cruza **normativa** (Capa B), anexa la advertencia citada. No sigas grillando sobre una base que ya sabes inválida.
- Cuando el interrogatorio cierre y quede conocimiento afirmado por el equipo, **guárdalo en el acto** (Real-Time Sync) en el `.md` que corresponda.
