import * as fs from 'fs';
import * as path from 'path';
import { loadRules } from './parser/rules';
import type { RuleSet } from '../../shared/types';

/**
 * User-editable categorization rules, stored as category-rules.json in the
 * app's userData dir (writable), seeded from the bundled default on first read.
 */
export class RulesService {
  private readonly file: string;

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, 'category-rules.json');
  }

  get(): RuleSet {
    try {
      if (fs.existsSync(this.file)) {
        return JSON.parse(fs.readFileSync(this.file, 'utf-8')) as RuleSet;
      }
    } catch {
      // fall through to the bundled default
    }
    return loadRules();
  }

  save(input: RuleSet): RuleSet {
    const clean: RuleSet = {
      exclude: Array.isArray(input.exclude)
        ? input.exclude.map((s) => String(s).trim()).filter(Boolean)
        : [],
      rules: Array.isArray(input.rules)
        ? input.rules
            .filter((r) => Array.isArray(r) && r.length === 2 && String(r[0]).trim())
            .map((r) => [String(r[0]).trim(), String(r[1]).trim()] as [string, string])
        : [],
      default:
        typeof input.default === 'string' && input.default.trim()
          ? input.default.trim()
          : 'Other',
    };
    fs.writeFileSync(this.file, JSON.stringify(clean, null, 2));
    return clean;
  }
}
