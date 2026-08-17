// Bump manually whenever the theme parser's extraction logic changes in a
// way that could affect which findings appear — a new field captured, a
// regex fixed, a new file type recognized. There's no automated way to
// detect "did the parser change"; this is a deliberately manual signal,
// the same discipline Rule.version already asks for (and has never yet
// needed, since no rule has had a second version).
export const PARSER_VERSION = "1.0.0";
