import { z } from 'zod';

import { parseLocaleNumber } from '@/src/lib/finance';

const localeNumber = (message = 'Número inválido') =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return value;
      return parseLocaleNumber(value);
    },
    z.number({ error: message }),
  );

const optionalLocaleInt = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = parseLocaleNumber(value);
  return Number.isFinite(n) ? Math.trunc(n) : value;
}, z.number().int().min(1).nullable().optional());

export const budgetGoalsSchema = z
  .object({
    living_pct: localeNumber('Porcentaje inválido').pipe(z.number().min(0).max(100)),
    comfort_pct: localeNumber('Porcentaje inválido').pipe(z.number().min(0).max(100)),
    savings_pct: localeNumber('Porcentaje inválido').pipe(z.number().min(0).max(100)),
  })
  .refine((v) => Math.round(v.living_pct + v.comfort_pct + v.savings_pct) === 100, {
    message: 'Los objetivos deben sumar 100%',
  });

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(40),
  icon: z.string().min(1).nullable().optional(),
  color: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Color inválido'),
  category: z.enum(['living', 'comfort', 'other']),
});

const splitSchema = z.object({
  user_id: z.string().uuid(),
  share_pct: localeNumber('Porcentaje inválido').pipe(z.number().positive().max(100)),
});

export const transactionSchema = z
  .object({
    type: z.enum(['expense', 'income']),
    amount: localeNumber('Monto inválido').pipe(z.number().positive('Monto inválido')),
    occurred_at: z.string().min(1),
    paid_by: z.string().uuid('Seleccioná quién pagó').optional(),
    splits: z.array(splitSchema).min(1, 'Elegí al menos un miembro'),
    tag_id: z.string().uuid().nullable().optional(),
    note: z.string().max(280).optional().nullable(),
    installment_total: optionalLocaleInt,
    installment_current: optionalLocaleInt,
    category_override: z.enum(['living', 'comfort']).optional().nullable(),
    create_tag: tagSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'expense' && !data.tag_id && !data.create_tag) {
      ctx.addIssue({ code: 'custom', message: 'Elegí una etiqueta', path: ['tag_id'] });
    }
    const sum = data.splits.reduce((acc, s) => acc + Number(s.share_pct), 0);
    if (Math.abs(sum - 100) > 0.05) {
      ctx.addIssue({
        code: 'custom',
        message: 'Los porcentajes de miembros deben sumar 100%',
        path: ['splits'],
      });
    }
    if (data.installment_total && data.installment_current && data.installment_current > data.installment_total) {
      ctx.addIssue({
        code: 'custom',
        message: 'La cuota actual no puede superar el total',
        path: ['installment_current'],
      });
    }
  });

export const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const familyNameSchema = z.object({
  name: z.string().trim().min(2, 'Nombre muy corto').max(60),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;
export type BudgetGoalsFormValues = z.infer<typeof budgetGoalsSchema>;
export type TagFormValues = z.infer<typeof tagSchema>;
