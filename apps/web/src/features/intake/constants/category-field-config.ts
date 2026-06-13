import type { CategorySpecificDataSchemas } from '@ethics/dto';

/** Kategori bazlı dinamik alan UI tanımları — schema anahtarları packages/dto ile eşleşir */
export type CategoryFieldConfig = {
  name: string;
  label: string;
  type: 'text' | 'textarea';
  maxLength?: number;
};

export const CATEGORY_FIELD_CONFIGS: Partial<
  Record<keyof CategorySpecificDataSchemas, readonly CategoryFieldConfig[]>
> = {
  EMBEZZLEMENT: [
    { name: 'estimatedAmount', label: 'Tahmini tutar', type: 'text', maxLength: 100 },
    { name: 'currency', label: 'Para birimi (ISO)', type: 'text', maxLength: 3 },
    { name: 'discoveryMethod', label: 'Tespit yöntemi', type: 'text', maxLength: 100 },
  ],
};
