import { ValueTransformer } from 'typeorm';

/** Keep numeric columns as plain JS numbers (drivers may return strings). */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null =>
    value === undefined || value === null ? null : value,
  from: (value?: string | number | null): number =>
    value === undefined || value === null ? 0 : parseFloat(String(value)),
};
