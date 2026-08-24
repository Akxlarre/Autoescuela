# Asignación ASG-b-055 — Escala tipográfica: eliminar los tamaños ilegibles y cerrar el ratchet ARCH-17

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-07-31
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-31
> **resulting_track:** fix-082-b-escala-tipografica-legible

---

## Contexto / Objetivo

`fix-032-m` migró 252 tamaños arbitrarios a la escala del DS y dejó un baseline de 66
instancias residuales "que requieren decisión de diseño". Reconteo de hoy (2026-07-31):
**84 instancias en 27 archivos**, distribuidas así:

| Tamaño | Usos | Diagnóstico |
|---|---|---|
| `text-[13px]` | 33 | Fuera de escala — cae entre `text-xs` (12px) y `text-sm` (14px) |
| `text-[9px]` | 27 | 🔴 **Ilegible.** Por debajo del piso absoluto del DS |
| `text-[11px]` | 9 | ⚠️ **Drift** — fix-032-m ya migró esta forma a `text-2xs` |
| `text-[10px]` | 6 | ⚠️ **Drift** — ídem |
| `text-[15px]` | 3 | Fuera de escala (entre `sm` 14px y `base` 16px) |
| `text-[8px]` | 2 | 🔴 **Ilegible.** |
| `text-[22px]` | 2 | Fuera de escala (entre `xl` 20px y `2xl` 24px) |
| `text-[17px]` | 2 | Fuera de escala |

Dos problemas distintos escondidos en el mismo número:

1. **29 instancias de 8-9px son un problema de legibilidad, no de tokens.** El DS ya
   declara `text-2xs` (10px) como "piso absoluto para micro-labels". 8-9px está por
   debajo del piso que el propio sistema fijó, y en uppercase con tracking (que es como
   suelen usarse) es directamente ilegible. No hay decisión de diseño que tomar acá:
   suben a `text-2xs`.
2. **15 instancias de 10-11px son drift puro.** `fix-032-m` migró exactamente esa forma
   a `text-2xs`. Que hayan vuelto significa que se escribieron **después** de la
   migración — el ratchet ARCH-17 solo alerta contra regresiones del baseline global, y
   como el número total bajó, estas 15 entraron sin que nadie se enterara.
   > Mismo patrón exacto que ASG-b-034 documentó para `color-mix()`: migración de una
   > sola corrida + guardrail que no distingue "se agregó algo nuevo" de "el total bajó".

## Alcance sugerido

1. **8-9px → `text-2xs`** (29 instancias). Sin decisión previa: el piso ya está definido.
2. **10-11px → `text-2xs`** (15 instancias). Es completar fix-032-m, no trabajo nuevo.
3. **13/15/17/22px (40 instancias) — esto sí es decisión de diseño.** Dos caminos:
   - **(a)** Encajarlos por redondeo a la escala existente (13→12 o 14, 15→14 o 16,
     17→18, 22→20 o 24). Barato, y mantiene la escala en 10 peldaños.
   - **(b)** Formalizar los peldaños que falten como token. Solo se justifica si al
     mirarlos en contexto resulta que 13px hace un trabajo real que 12 y 14 no hacen —
     con 33 usos, no es descartable de entrada.
   > Recomendación: (a) para 15/17/22 (7 usos, claramente ad-hoc) y mirar 13px aparte,
   > que por volumen puede ser una necesidad real y no un descuido.
4. **Re-baselinear el ratchet**: `npm run lint:arch -- --update-ds-baseline`. Si tras la
   migración el residual queda en 0, **subir ARCH-17 de ratchet a error duro** — es la
   única forma de que la categoría no vuelva a driftear.

## Referencias

- `indices/ANTI-PATTERNS.md` §AP-014 — la regla y la historia de fix-032-m.
- `src/styles/tokens/_variables.scss` — escala tipográfica (líneas ~64-90), donde
  `text-2xs` está documentado como piso absoluto.
- `scripts/lib/class-discipline.baseline.json` — baseline del ratchet.
- `docs/BACKLOG-DEUDA-TECNICA.md` §"Residual del ratchet ARCH-17".

## Cómo reproducir el conteo

```bash
grep -rho "text-\[[0-9]\+px\]" src/app --include="*.ts" | sort | uniq -c | sort -rn
```

## Notas para quien la reclame

- Los puntos 1 y 2 (44 de las 84 instancias) **no requieren ninguna decisión** — se pueden
  cerrar de entrada y dejan el problema reducido a los 40 que sí la requieren.
- El punto 4 es el que evita repetir esta asignación en seis meses. No lo saltees.
- Si el equipo elige (b) para 13px, agregar el token a la escala **y** al `@theme` de
  `tailwind.css`, si no ARCH-11 lo va a marcar como clase muerta.
