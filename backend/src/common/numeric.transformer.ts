import { ValueTransformer } from 'typeorm';

/**
 * Postgres `numeric` columns come back as strings via node-postgres.
 * This transformer keeps them as plain numbers on the entity.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null =>
    value === undefined || value === null ? null : value,
  from: (value?: string | null): number =>
    value === undefined || value === null ? 0 : parseFloat(value),
};
