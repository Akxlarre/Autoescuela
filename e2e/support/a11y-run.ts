/** Corre axe en el navegador (spec 0054-b). Separado de `a11y.ts` para que vitest no lo importe. */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { A11Y_TAGS, summarizeViolations, type A11yViolation } from './a11y';

/** Corre axe (WCAG 2 A/AA) sobre la página y devuelve el resumen. */
export async function runAxe(page: Page): Promise<A11yViolation[]> {
  const result = await new AxeBuilder({ page }).withTags(A11Y_TAGS).analyze();
  return summarizeViolations(result);
}
