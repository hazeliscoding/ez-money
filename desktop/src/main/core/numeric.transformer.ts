import { ValueTransformer } from 'typeorm';

/**
 * TypeORM value transformer for `numeric` columns. SQLite/sql.js can hand back
 * numeric values as strings, which would silently break arithmetic and JSON
 * shapes — so `from` always parses to a real number (null/undefined → 0). `to`
 * passes numbers through, preserving null so the DB can store NULL.
 */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null): number | null =>
    value === undefined || value === null ? null : value,
  from: (value?: string | number | null): number =>
    value === undefined || value === null ? 0 : parseFloat(String(value)),
};
