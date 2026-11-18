import { z } from 'zod';
const name = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\p{L}\p{N} ._'-]+$/u, 'Pseudo : lettres, chiffres, espaces et . _ - uniquement.');
const code = z.string().regex(/^[A-F0-9]{12}$/);
const move = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start'), piece: z.string().regex(/^[0-5]-[0-3]$/) }).strict(),
  z
    .object({
      kind: z.literal('swap'),
      piece: z.string().regex(/^[0-5]-[0-3]$/),
      target: z.string().regex(/^[0-5]-[0-3]$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal('move'),
      piece: z.string().regex(/^[0-5]-[0-3]$/),
      steps: z.number().int().min(-4).max(12),
      home: z.boolean().optional(),
    })
    .strict(),
]);
const version = z.number().int().nonnegative();
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('create'),
      name,
      capacity: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6)]),
    })
    .strict(),
  z.object({ type: z.literal('join'), code, name }).strict(),
  z.object({ type: z.literal('sync'), code }).strict(),
  z.object({ type: z.literal('start'), code, version }).strict(),
  z
    .object({
      type: z.literal('exchange'),
      code,
      version,
      cardIndex: z.number().int().min(0).max(5),
    })
    .strict(),
  z
    .object({
      type: z.literal('play'),
      code,
      version,
      play: z
        .object({ cardIndex: z.number().int().min(0).max(5), moves: z.array(move).max(4) })
        .strict(),
    })
    .strict(),
]);
export type Command = z.infer<typeof commandSchema>;
