/**
 * Which documents have a translation and where it lives. Paths and patterns in these options are relative to `root`
 * and use `/`; patterns are `fs.globSync` patterns, and `node_modules` directories are never searched.
 */
export interface DocTranslationsOptions {
  /** Repository root. Defaults to the working directory. */
  root?: string;
  /** Documents that must have a translation. Files that `translations` or `exclude` match are left out. */
  sources: string[];
  /** Every translation file. A match that is not the translation of a document in `sources` is reported. */
  translations: string[];
  /** Documents in `sources` that have no translation, such as templates. */
  exclude?: string[];
  /**
   * The translation path of a source path, for example `docs/en/x.md` to `docs/zh-CN/x.md`. It must differ from the
   * source, be unique, and match `translations`; the check reports a mapping that does not.
   */
  translationOf: (source: string) => string;
  /** The line a translation must start with, given its source path. Not checked when omitted. */
  header?: (source: string) => string;
  /**
   * Require a `<!-- source-blob: <hash> -->` line after the header, holding the Git blob hash of the source when the
   * translation was last confirmed, so that editing a source without its translation fails. `--write` records it.
   */
  stamp?: boolean;
}

/**
 * Checks every pair: the translation exists, starts with the header and the current stamp, and has the source's
 * headings (levels in order), code blocks (unchanged), tables (rows and columns), list items (kind and indent) and
 * links in the same order. A link to a document that has a translation must point to that translation, a link to a
 * translation must point back to its source, a link starting with `/` resolves from `root`, and every fragment in a
 * translation must name a GitHub heading anchor or an `id` in its target. A translation without a source in scope is
 * reported too.
 */
export declare function checkDocTranslations(options: DocTranslationsOptions): { pairs: number; problems: string[] };

/**
 * Command line entry for a repository script: with no arguments, runs `checkDocTranslations` and prints the result;
 * `--write <file>...` (paths relative to the working directory; either file of a pair names it) first records the
 * current stamp of each named pair whose translation passes every other check, and needs `stamp: true`; `--help`
 * prints the usage. Returns the exit code: 0 when every check passes, 1 on problems, 2 on a usage error.
 */
export declare function runDocTranslations(options: DocTranslationsOptions, argv?: string[]): number;
