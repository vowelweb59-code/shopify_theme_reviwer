// Structural facts extracted from a theme file. The parser makes no rule
// judgments, assigns no severity — Phase 3 decides what these facts mean.

export type SourceLocation = {
  line: number;
  column?: number;
};

export type FileType = "liquid" | "json" | "css" | "js";

export type ParsedImage = {
  line: number;
  tag?: "img" | "image" | "source";
  alt: string | null;
  altSource: "literal" | "liquid" | "missing" | "empty";
  hasWidth: boolean;
  hasHeight: boolean;
  loading: string | null;
  src?: string;
  sourceExpression?: string;
  lazyLoadPattern?: string;
  isLikelyDecorative: boolean;
};

export type ParsedSvgElement = {
  line: number;
  isUseElement: boolean;
  hasTitle: boolean;
  ariaHidden: boolean;
  role: string | null;
  ariaLabel: string | null;
  href: string | null;
};

export type ParsedIconElement = {
  line: number;
  kind: "icon-font" | "icon-span";
  classes: string[];
  ariaHidden: boolean;
  role: string | null;
  ariaLabel: string | null;
};

export type ParsedHeading = {
  line: number;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text?: string;
  sourceExpression?: string;
};

export type ParsedLink = {
  line: number;
  href: string | null;
  text: string | null;
  target: string | null;
  rel: string | null;
  ariaLabel: string | null;
};

export type ParsedButton = {
  line: number;
  text: string | null;
  type: string | null;
  disabled: boolean;
  ariaLabel: string | null;
};

export type ParsedForm = {
  line: number;
  action: string | null;
  method: string | null;
};

export type ParsedInput = {
  line: number;
  tag: "input" | "select" | "textarea";
  type?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  required?: boolean;
};

export type ParsedLabel = {
  line: number;
  for?: string;
  text?: string;
};

export type ParsedInteractiveElement = {
  line: number;
  tag: string;
  role: string | null;
  tabIndex: number | null;
  ariaAttributes: Record<string, string>;
  hasClickHandlerAttr: boolean;
};

export type ParsedSchemaBlock = {
  line: number;
  endLine?: number;
  json: Record<string, unknown> | null;
  parseError: string | null;
  rawJson: string;
};

export type ParsedJsonLdBlock = {
  line: number;
  endLine?: number;
  json: unknown | null;
  parseError: string | null;
  rawJson: string;
  types: string[];
};

export type ParsedString = {
  line: number;
  text: string;
  confidence: "high" | "medium" | "low";
};

export type ParsedTranslationReference = {
  line: number;
  key: string;
  filter: string;
};

export type ParsedScript = {
  line: number;
  src: string | null;
  inline: boolean;
  location: "head" | "body" | "unknown";
  async: boolean;
  defer: boolean;
  type?: string;
};

export type ParsedStylesheet = {
  line: number;
  href: string | null;
  inline: boolean;
};

export type ParsedMetaTags = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  robots: string | null;
  htmlLang: string | null;
};

export type ParsedLiquidTag = {
  line: number;
  tag: string;
  raw: string;
};

export type ParsedLiquidReference = {
  line: number;
  kind: "object" | "filter" | "tag";
  name: string;
};

export type ParsedDeprecatedReference = {
  line: number;
  token: string;
  referenceType: "object" | "filter" | "tag" | "other";
};

export type ParsedAssetReference = {
  line: number;
  kind: "image" | "css" | "js" | "font" | "other";
  reference: string;
};

export type ParsedSectionReference = {
  line: number;
  kind: "section" | "snippet" | "template";
  name: string;
  dynamic: boolean; // true when the target can't be statically resolved (e.g. a variable)
};

export type ParsedLocaleReference = {
  line: number;
  key: string;
};

export type ParsedSettingReference = {
  line: number;
  key: string;
};

export type ParsedFileReference = {
  line: number;
  path: string;
};

export type ParsedParseError = {
  line?: number;
  message: string;
  context?: string;
};

// CSS-specific structured data. Only populated for fileType 'css'.
export type ParsedCssInfo = {
  focusRules: { line: number; selector: string }[];
  focusVisibleRules: { line: number; selector: string }[];
  outlineRemovals: { line: number; selector: string }[];
  colorDeclarations: { line: number; selector: string; property: string; value: string }[];
  mediaQueries: { line: number; params: string }[];
};

// Plain-JSON-file structured data (templates/*.json, config/*.json,
// locales/*.json). Only populated for fileType 'json'.
export type ParsedJsonFileInfo = {
  json: unknown | null;
  parseError: string | null;
  sectionReferences: ParsedSectionReference[];
  settingKeys: string[];
  localeKeys: string[];
  duplicateLocaleKeys: string[];
};

export type ParsedFile = {
  path: string;
  fileType: FileType;
  rawText: string;
  lineCount: number;

  images: ParsedImage[];
  svgElements: ParsedSvgElement[];
  iconElements: ParsedIconElement[];
  headings: ParsedHeading[];
  links: ParsedLink[];
  buttons: ParsedButton[];
  forms: ParsedForm[];
  inputs: ParsedInput[];
  labels: ParsedLabel[];
  interactiveElements: ParsedInteractiveElement[];

  schemaBlocks: ParsedSchemaBlock[];
  jsonLdBlocks: ParsedJsonLdBlock[];

  hardcodedStrings: ParsedString[];
  translationReferences: ParsedTranslationReference[];

  scripts: ParsedScript[];
  stylesheets: ParsedStylesheet[];
  metaTags: ParsedMetaTags;

  liquidTags: ParsedLiquidTag[];
  liquidObjects: ParsedLiquidReference[];
  deprecatedReferences: ParsedDeprecatedReference[];

  assetReferences: ParsedAssetReference[];
  sectionReferences: ParsedSectionReference[];
  localeReferences: ParsedLocaleReference[];
  settingReferences: ParsedSettingReference[];
  linksToFiles: ParsedFileReference[];

  cssInfo?: ParsedCssInfo;
  jsonInfo?: ParsedJsonFileInfo;

  parseErrors: ParsedParseError[];
};

export function emptyMetaTags(): ParsedMetaTags {
  return { title: null, description: null, canonical: null, openGraph: {}, twitter: {}, robots: null, htmlLang: null };
}

export function emptyParsedFile(path: string, fileType: FileType, rawText: string): ParsedFile {
  return {
    path,
    fileType,
    rawText,
    lineCount: rawText.length === 0 ? 0 : rawText.split("\n").length,
    images: [],
    svgElements: [],
    iconElements: [],
    headings: [],
    links: [],
    buttons: [],
    forms: [],
    inputs: [],
    labels: [],
    interactiveElements: [],
    schemaBlocks: [],
    jsonLdBlocks: [],
    hardcodedStrings: [],
    translationReferences: [],
    scripts: [],
    stylesheets: [],
    metaTags: emptyMetaTags(),
    liquidTags: [],
    liquidObjects: [],
    deprecatedReferences: [],
    assetReferences: [],
    sectionReferences: [],
    localeReferences: [],
    settingReferences: [],
    linksToFiles: [],
    parseErrors: [],
  };
}
