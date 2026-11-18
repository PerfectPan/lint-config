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
  /**
   * The line a translation must start with, given its source path; in a translation with YAML frontmatter, the first
   * line after it. Not checked when omitted.
   */
  header?: (source: string) => string;
  /**
   * Require the Git blob hash of the source when the translation was last confirmed, so that editing a source without
   * its translation fails: a `source-blob: <hash>` key in the frontmatter of a translation that has one (MDX does not
   * compile HTML comments), otherwise a `<!-- source-blob: <hash> -->` line after the header. `--write` records it.
   */
  stamp?: boolean;
}

/**
 * Checks every pair: the translation exists, has the header and the current stamp where `header` and `stamp` say, and
 * has the source's headings (levels in order), code blocks (language and body unchanged; the meta after the language,
 * such as a `title="…"`, may be translated), tables (rows and columns), list items (kind and indent) and links in the
 * same order. YAML frontmatter opening either file is not compared. A link to a document that has a translation must
 * point to that translation, a link to a translation must point back to its source, a link starting with `/` resolves
 * from `root`, and every fragment in a translation that points to a `.md` file must name a GitHub heading anchor or an
 * `id` in it. A translation without a source in scope is reported too.
 */
export declare function checkDocTranslations(options: DocTranslationsOptions): { pairs: number; problems: string[] };

/**
 * Command line entry for a repository script: with no arguments, runs `checkDocTranslations` and prints the result;
 * `--write <file>...` (paths relative to the working directory; either file of a pair names it) first records the
 * current stamp of each named pair whose translation passes every other check, and needs `stamp: true`; `--help`
 * prints the usage. Returns the exit code: 0 when every check passes, 1 on problems, 2 on a usage error.
 */
export declare function runDocTranslations(options: DocTranslationsOptions, argv?: string[]): number;
