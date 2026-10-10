import { z } from 'zod';

export const idParam = (nome = 'id') =>
  z.object({ [nome]: z.coerce.number({ error: 'Deve ser um número.' }).int().positive() });

export const booleanQuery = z
  .enum(['true', 'false'], { error: 'Use true ou false.' })
  .transform((v) => v === 'true');

export const enumMsg = (valores: readonly string[]) => ({
  error: (iss: { input?: unknown }) =>
    iss.input === undefined
      ? `Campo obrigatório. Valores: ${valores.join(', ')}`
      : `Valor inválido. Valores: ${valores.join(', ')}`,
});
