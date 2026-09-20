# Content validation

Run `npm run validate` to validate the authored game data, or `npm run validate -- path/to/content.json` to validate an exported JSON document. Invalid input sets exit code 1 and prints its field paths. No combat simulation runs during validation.

The public API exports:

- `validateContent(input: unknown)`: returns `{ valid, issues }`, where each issue contains a `path` and `message`.
- `assertValidContent(input: unknown)`: narrows the value to `GameContent`, or throws `ContentValidationError` with its `issues` array.

Zod schemas check all versioned definitions, bounded finite values, selectors, compatible action payloads, and the four party scaling entries. A separate reference pass checks identifiers, unit skill/effect bindings, status and encounter references, event target availability, and periodic-only duration scaling. Repeated enemy IDs in encounters are valid packs; repeated skill/effect bindings on a unit are invalid.

Dice syntax allows an optional count (for example `d20`), supported sides 4/6/8/10/12/20, and an optional integer modifier. Counts are 1–1000, modifier magnitude is at most 1,000,000, and expressions are at most 64 characters. These syntax constraints match the engine contract; this tool does not import the engine or duplicate gameplay formulas.
