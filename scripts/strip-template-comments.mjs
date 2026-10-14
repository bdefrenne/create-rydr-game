// Strips comments out of Lit `css`/`html`/`svg` tagged templates.
//
// esbuild's minifier removes JS comments but cannot touch a template literal, which is a string,
// so every `/* … */` in a component's styles and every `<!-- … -->` in its markup shipped in the
// production bundle verbatim, design notes and ticket numbers included. This removes them.
//
// The SAME file lives in rydr-game-sdk, rydr-core-world-editor, rydr-platform, create-rydr-game
// and every game repo (games sit on SDK majors 5 to 12, so it cannot be an SDK export). Change one,
// copy it to all.
//
// Untagged templates are covered too, because that is how a lot of CSS is written
// (`const cssText = \`…\`` handed to `unsafeCSS`, or a <style>'s textContent), but more carefully:
// a `/*` there must follow whitespace or `;{}`, so text such as `src/*.ts` is never touched. A
// template with any OTHER tag is left alone (`String.raw`, `str`): its tag reads the text, and so
// is the first argument of `msg()` (see `visitKept`).
//
// Only a comment wholly inside one literal piece is removed (never one around a `${}`), and
// `/*! … */` legal comments stay.
//
// TypeScript is loaded on first use, never at import: the platform's vite.config imports this
// file, and a game running the shell through `npx rydr-dev-shell` has no devDependencies there.
// Dev never calls it (the plugin is build-only).

import { createRequire } from "node:module";

let ts;
const loadTs = () => (ts ??= createRequire(import.meta.url)("typescript"));

const TAGS = new Set(["css", "html", "svg"]);
const CSS_COMMENT = /\/\*(?!!)[\s\S]*?\*\//g;
const LOOSE_CSS_COMMENT = /(?<=^|[\s;{}])\/\*(?!!)[\s\S]*?\*\//g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const MAYBE = /\/\*|<!--/;

/** Returns `code` without template comments, or `null` when there was nothing to strip. */
export function stripTemplateComments(code, fileName = "file.ts") {
  const edits = findTemplateComments(code, fileName);
  if (!edits.length) return null;
  let out = code;
  for (const [from, to, replacement] of edits.sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, from) + replacement + out.slice(to);
  }
  return out;
}

/** The comments to remove, as `[from, to, replacement]`. */
export function findTemplateComments(code, fileName = "file.ts") {
  if (!MAYBE.test(code)) return [];
  loadTs();
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX
    : /\.ts$/.test(fileName) ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, false, kind);
  const edits = [];

  const piece = (node, from, to, tag) => {
    const text = code.slice(from, to);
    // An html`` template can hold a <style>, hence the CSS pattern there too.
    const patterns = tag === "css" ? [CSS_COMMENT] : [HTML_COMMENT, LOOSE_CSS_COMMENT];
    const found = [];
    for (const re of patterns) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(text)); ) found.push([m.index, m.index + m[0].length, m[0]]);
    }
    // Two patterns can overlap (`<!-- /* x */ -->`): the one that starts first wins.
    let reached = 0;
    for (const [start, end, comment] of found.sort((a, b) => a[0] - b[0])) {
      if (start < reached) continue;
      reached = end;
      // A CSS comment is a token separator (`a/**/b` is two idents), so it becomes a space;
      // newlines are kept so line numbers in a hidden source map stay right. An HTML comment
      // renders nothing, so it becomes nothing: a space there would be a visible gap.
      const lines = comment.split("\n").length - 1;
      const replacement = comment.startsWith("/*") ? (lines ? "\n".repeat(lines) : " ") : "";
      edits.push([from + start, from + end, replacement]);
    }
  };

  const literal = (t, tag) => {
    if (ts.isNoSubstitutionTemplateLiteral(t)) {
      piece(t, t.getStart(source) + 1, t.end - 1, tag);
    } else {
      piece(t.head, t.head.getStart(source) + 1, t.head.end - 2, tag);
      for (const span of t.templateSpans) {
        const lit = span.literal;
        const tail = ts.isTemplateTail(lit);
        piece(lit, lit.getStart(source) + 1, lit.end - (tail ? 1 : 2), tag);
      }
    }
  };

  // Inside `msg(…)` nothing is touched: lit-localize finds a translation by hashing its English
  // text at runtime, so one changed character and a French rider silently reads English.
  const visitKept = (node) => {
    if (ts.isTemplateExpression(node)) node.templateSpans.forEach((s) => visit(s.expression));
    else if (ts.isTaggedTemplateExpression(node)) visitKept(node.template);
    else if (!ts.isNoSubstitutionTemplateLiteral(node)) visit(node);
  };

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "msg") {
      node.arguments.forEach((arg, i) => (i === 0 ? visitKept(arg) : visit(arg)));
      return;
    }
    if (ts.isTaggedTemplateExpression(node)) {
      if (ts.isIdentifier(node.tag) && TAGS.has(node.tag.text)) {
        literal(node.template, node.tag.text === "css" ? "css" : "html");
      }
      // Any other tag: its text is the tag's business. The tag and the `${}` inside still get visited.
      ts.forEachChild(node.tag, visit);
      if (!ts.isNoSubstitutionTemplateLiteral(node.template)) node.template.templateSpans.forEach((s) => visit(s.expression));
      return;
    }
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) literal(node, "loose");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return edits;
}

// Strips HTML comments from a page, and CSS comments from its <style> blocks. Conditional
// comments (`<!--[if`) stay.
export function stripHtmlComments(page) {
  return page
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, body, close) =>
      open + body.replace(LOOSE_CSS_COMMENT, (c) => (c.includes("\n") ? "\n" : " ")) + close);
}

/**
 * Vite plugin: strips template comments from every module of a production build, and comments
 * from its HTML pages (Vite minifies neither).
 */
export function stripTemplateCommentsPlugin() {
  // magic-string, when the project has it, gives the edit a real source map, which matters
  // wherever a build keeps hidden maps (the mobile app's, for Sentry). Vite 6 bundles its own
  // copy rather than installing it, so most games do not have it, and keep no maps either: there
  // the edit simply goes without one. Loaded on first use, never at a dev server's config load.
  let MagicString;
  const loadMagicString = () => {
    if (MagicString === undefined) {
      try { MagicString = createRequire(`${process.cwd()}/`)("magic-string"); } catch { MagicString = null; }
    }
    return MagicString;
  };
  return {
    name: "rydr:strip-template-comments",
    apply: "build",
    enforce: "pre",
    transformIndexHtml: { order: "post", handler: stripHtmlComments },
    transform(code, id) {
      const [file, query = ""] = id.split("?");
      // An inline <script type="module"> reaches here as `page.html?html-proxy&index=0.js`.
      if (!/\.(m?[jt]s|tsx)$/.test(file) && !query.startsWith("html-proxy")) return null;
      // Of the dependencies only our own carry our comments (an older SDK's dist, the world
      // editor); parsing three.js on every build would cost seconds for nothing.
      if (file.includes("/node_modules/") && !file.includes("/node_modules/@rydr/")) return null;
      const edits = findTemplateComments(code, file);
      if (!edits.length) return null;
      const Magic = loadMagicString();
      if (!Magic) return { code: stripTemplateComments(code, file), map: null };
      const s = new Magic(code);
      for (const [from, to, replacement] of edits) {
        if (replacement) s.overwrite(from, to, replacement);
        else s.remove(from, to);
      }
      return { code: s.toString(), map: s.generateMap({ hires: "boundary", source: file }) };
    },
  };
}
