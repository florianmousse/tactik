import { z } from 'zod';
const baseCard = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(-4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(12),
  z.literal('swap'),
]);
const name = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[\p{L}\p{N} ._'-]+$/u, 'Pseudo : lettres, chiffres, espaces et . _ - uniquement.');
const code = z.string().regex(/^(?:[A-Z2-9]{8}|[A-F0-9]{12})$/);
const move = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start'), piece: z.string().regex(/^[0-7]-[0-3]$/) }).strict(),
  z
    .object({
      kind: z.literal('swap'),
      piece: z.string().regex(/^[0-7]-[0-3]$/),
      target: z.string().regex(/^[0-7]-[0-3]$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal('move'),
      piece: z.string().regex(/^[0-7]-[0-3]$/),
      steps: z.number().int().min(-4).max(12),
      home: z.boolean().optional(),
    })
    .strict(),
]);
const version = z.number().int().nonnegative();
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('leave'), code, version, connection: z.uuid() }).strict(),
  z
    .object({
      type: z.literal('presence'),
      code,
      version,
      connection: z.uuid(),
      active: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('list') }).strict(),
  z
    .object({ type: z.literal('kick'), code, version, seat: z.number().int().min(1).max(7) })
    .strict(),
  z
    .object({
      type: z.literal('create'),
      name,
      capacity: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6), z.literal(8)]),
      jokers: z.boolean().optional(),
      public: z.boolean().optional(),
    })
    .strict(),
  z.object({ type: z.literal('join'), code, name }).strict(),
  z.object({ type: z.literal('sync'), code }).strict(),
  z.object({ type: z.literal('start'), code, version }).strict(),
  z.object({ type: z.literal('bot-add'), code, version }).strict(),
  z
    .object({ type: z.literal('bot-remove'), code, version, seat: z.number().int().min(1).max(7) })
    .strict(),
  z.object({ type: z.literal('bot-tick'), code, version }).strict(),
  z.object({ type: z.literal('discard-hand'), code, version }).strict(),
  z
    .object({
      type: z.literal('chat'),
      code,
      id: z.uuid(),
      text: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .refine((s) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)),
    })
    .strict(),
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
        .object({
          cardIndex: z.number().int().min(0).max(5),
          moves: z.array(move).max(4),
          as: baseCard.optional(),
        })
        .strict(),
    })
    .strict(),
]);
export type Command = z.infer<typeof commandSchema>;
