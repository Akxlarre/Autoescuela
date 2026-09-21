// supabase/functions/_shared/template-tokens.test.ts
//
//   deno test supabase/functions/_shared/template-tokens.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { substituteTokens } from './template-tokens.ts';

Deno.test('substituteTokens: token conocido se reemplaza por su valor', () => {
  assertEquals(
    substituteTokens('Saldo: {{saldoPendiente}}.', { saldoPendiente: '$50.000' }),
    'Saldo: $50.000.',
  );
});

Deno.test('substituteTokens: token desconocido se reemplaza por string vacío, sin lanzar', () => {
  assertEquals(
    substituteTokens('Saldo: {{saldopendiente}}.', { saldoPendiente: '$50.000' }),
    'Saldo: .',
  );
});

Deno.test('substituteTokens: texto sin ningún token queda igual', () => {
  assertEquals(
    substituteTokens('Texto plano sin placeholders.', {}),
    'Texto plano sin placeholders.',
  );
});

Deno.test(
  'substituteTokens: el mismo token repetido 2 veces en el texto se reemplaza en ambas',
  () => {
    assertEquals(
      substituteTokens('{{nombreEscuela}} y {{nombreEscuela}} otra vez', {
        nombreEscuela: 'Chillán',
      }),
      'Chillán y Chillán otra vez',
    );
  },
);

Deno.test('substituteTokens: texto vacío devuelve texto vacío', () => {
  assertEquals(substituteTokens('', { x: 'y' }), '');
});
