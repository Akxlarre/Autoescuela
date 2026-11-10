# Acceptance {{ID}} — {{TITLE}}

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** {{DATE}}
> **Verifier:** ac-verifier (Haiku) · validado por {{OWNER}}

---

## Resumen

- AC totales: {{N}}
- AC cumplidos: {{M}}
- AC fallidos: {{N-M}}
- AC con evidencia: {{con_evidencia}}

**Veredicto final:** ✅ PASA / ❌ NO PASA / ⚠️ PARCIAL

---

## Verificación por AC

### AC1 — {{enunciado breve}}

- **Estado:** ✅ cumplido / ❌ no cumplido / ⚠️ parcial
- **Evidencia:**
  - Commit: `<hash>` — {{descripción}}
  - Test: `path/al/test.spec.ts:NN` — caso `should ...`
  - Screenshot: `docs/screenshots/spec-NNNN-ac1.png` (si aplica)
  - QA manual: {{nombre verificador}} verificó el {{fecha}}
- **Notas:** …

### AC2 — …

(repetir bloque por cada AC + edge cases)

---

## Out-of-scope respetado

> Lista los items declarados out-of-scope en la spec y confirma que NO se implementaron.

- ❌ {{item out-of-scope 1}} — confirmado: no entró
- ❌ {{item out-of-scope 2}} — confirmado: no entró

---

## Deuda técnica detectada

> Cosas que quedaron mal o a medias que NO bloquean el cierre de la spec
> pero deberían entrar en spec nueva.

- {{deuda 1}} → propuesta: spec NNNN
- {{deuda 2}} → propuesta: spec NNNN

---

## Cambios en índices

- `indices/COMPONENTS.md` — agregadas: …
- `indices/SERVICES.md` — agregadas: …
- `indices/FACADES.md` — agregadas: …
- `indices/DATABASE.md` — agregadas: …
- `indices/MODELS.md` — agregadas: …

---

## Post-mortem (opcional)

- Qué salió mejor de lo esperado: …
- Qué fricciones encontramos: …
- Qué cambiaríamos en el siguiente ciclo SDD: …

---

## Firma de cierre

- [ ] Todos los AC cumplidos con evidencia
- [ ] Out-of-scope respetado
- [ ] Índices actualizados
- [ ] Tests pasando en CI
- [ ] `lint:arch` limpio
- [ ] Sin deuda crítica abierta

**Cerrado por:** {{OWNER}}
**Fecha:** {{DATE}}
