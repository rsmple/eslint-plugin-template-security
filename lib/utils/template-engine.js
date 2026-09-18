// Server-side template engines, as `@html-eslint/parser` leaves them: every
// `{{ … }}`, `{% … %}`, `<%= … %>` or `<?= … ?>` is a `Template` part, with
// its delimiters in `open` and `close`, inside attribute keys and values,
// text, and `<script>` / `<style>` content.

// `@html-eslint/parser`'s `templateEngineSyntax` for each engine
const JINJA = [{open: '{{', close: '}}'}, {open: '{%', close: '%}'}, {open: '{#', close: '#}', isComment: true}]
const ERB = [{open: '<%', close: '%>'}]

export const TEMPLATE_ENGINE_SYNTAX = {
  blade: [{open: '{{--', close: '--}}', isComment: true}, {open: '{!!', close: '!!}'}, {open: '{{', close: '}}'}],
  ejs: ERB,
  erb: ERB,
  handlebars: [{open: '{{{', close: '}}}'}, {open: '{{', close: '}}'}],
  jinja: JINJA,
  jsp: [{open: '${', close: '}'}, {open: '<%', close: '%>'}],
  liquid: JINJA,
  php: [{open: '<?', close: '?>'}],
  twig: JINJA,
}

// Checked in order, so `.blade.php` wins over `.php`
const EXTENSIONS = [
  [/\.blade\.php$/i, 'blade'],
  [/\.(?:php|phtml)$/i, 'php'],
  [/\.(?:j2|jinja2?|njk|nunjucks)$/i, 'jinja'],
  [/\.twig$/i, 'twig'],
  [/\.(?:hbs|handlebars|mustache)$/i, 'handlebars'],
  [/\.erb$/i, 'erb'],
  [/\.ejs$/i, 'ejs'],
  [/\.liquid$/i, 'liquid'],
  [/\.(?:jsp|jspx|tag)$/i, 'jsp'],
]

// `settings: {'template-security': {engine: 'jinja'}}`, or the file extension.
// `undefined` for plain `.html`, where only syntax every engine agrees on counts.
export const engineOf = (context) => {
  const engine = context.settings?.['template-security']?.engine

  if (engine !== undefined) return engine

  return EXTENSIONS.find(([pattern]) => pattern.test(context.filename))?.[1]
}

// What a `Template` part writes into the page: `{code, escaped}` for an output
// tag, where `escaped` says whether the engine HTML-escapes it by default, and
// `undefined` for statements, comments and blocks.
export const templateOutput = (part, engine, text) => {
  const open = part.open.value
  const inner = part.value.slice(open.length, part.value.length - part.close.value.length)

  switch (open) {
    case '{{': {
      // Blade's `@{{ x }}` prints the braces for a client-side framework
      if (text[part.range[0] - 1] === '@') return undefined
      // Blade `{{-- comment --}}`
      if (inner.startsWith('--')) return undefined
      // Handlebars `{{{ raw }}}`, read with `{{`/`}}` delimiters as `{{{ raw }}` and `}`
      if (inner.startsWith('{')) return {code: inner.slice(1).trim(), escaped: false}

      // Whitespace control: `{{- x -}}` (Jinja, Twig, Liquid), `{{~ x ~}}` (Handlebars)
      const code = inner.replace(/^[-~+]/, '').replace(/[-~+]$/, '').trim()

      // Handlebars blocks, comments, partials and `{{else}}`
      if (/^(?:[#/^!>*]|else\b)/.test(code)) return undefined
      if (code.startsWith('&')) return {code: code.slice(1).trim(), escaped: false}

      return {code, escaped: engine !== 'liquid'}
    }
    case '{{{':
    case '{!!':
    case '[(':
      return {code: inner.trim(), escaped: false}
    case '[[':
      return {code: inner.trim(), escaped: true}
    case '{%':
    case '{#':
    case '{{--':
      return undefined
    case '<%': {
      // JSP `<%-- comment --%>`
      if (inner.startsWith('--')) return undefined
      if (inner.startsWith('==')) return {code: inner.slice(2).trim(), escaped: false}
      if (inner.startsWith('=')) return {code: inner.slice(1).replace(/-$/, '').trim(), escaped: engine !== 'jsp'}
      // EJS unescaped output; in ERB `<%-` is code with whitespace trimming
      if (inner.startsWith('-') && engine !== 'erb') return {code: inner.slice(1).replace(/-$/, '').trim(), escaped: false}

      return undefined
    }
    case '<?': {
      // PHP escapes nothing on its own
      if (inner.startsWith('=')) return {code: inner.slice(1).replace(/;?\s*$/, '').trim(), escaped: false}

      const echo = /^php\s+(?:echo|print)\b([\s\S]*)$/i.exec(inner)

      return echo ? {code: echo[1].replace(/;?\s*$/, '').trim(), escaped: false} : undefined
    }
    // JSP expression language prints as is; `<c:out>` escapes
    case '${':
      return {code: inner.trim(), escaped: false}
    default:
      return {code: inner.trim(), escaped: engine !== 'liquid' && engine !== 'php' && engine !== 'jsp'}
  }
}

// Output that can only be one of a few fixed strings: `'a'`, `'&nbsp;'|safe`,
// `cond ? 'a' : 'b'` (PHP, Blade, ERB, JSP) or `'a' if cond else 'b'` (Jinja)
const STRING = String.raw`(?:'[^'\\]*'|"[^"\\]*")`
const CONSTANT_OUTPUTS = [
  new RegExp(`^${ STRING }(?:\\s*\\|\\s*(?:safe|raw)\\b)*$`),
  new RegExp(`^[^'"?]+\\?\\s*${ STRING }\\s*:\\s*${ STRING }$`),
  new RegExp(`^${ STRING }\\s+if\\s+[^'"]+?(?:\\s+else\\s+${ STRING })?$`),
]

export const isConstantOutput = (code) => CONSTANT_OUTPUTS.some(pattern => pattern.test(code))

// Attributes whose value is JavaScript: HTML event handlers, htmx `hx-on`,
// Alpine directives and their `@` / `:` shorthands, Knockout bindings
const isHandlerName = (key) => /^on[a-z]/.test(key)
  || /^(?:data-)?hx-(?:on\b|vars$)/.test(key)
  || /^x-(?!cloak$|ignore$|ref$|transition|teleport$)/.test(key)
  || /^[@:]/.test(key)
  || key === 'data-bind'

// `hx-vals` and `hx-headers` are JSON, unless prefixed with `js:`
const isScriptValue = (key, value) => /^(?:data-)?hx-(?:vals|headers)$/.test(key) && /^\s*(?:js|javascript):/i.test(value)

// `<script>` content the browser runs or parses as JSON; `text/template` and
// the like are inert until a client-side library inserts them as HTML
export const isScriptType = (type) => type === undefined || /^\s*$|(?:java|ecma)script|^\s*module\s*$|json|importmap|speculationrules/i.test(type)

// Whether an attribute's value, `key` lowercased, is run as JavaScript
export const isScriptAttribute = (key, value = '') => isHandlerName(key) || isScriptValue(key, value)

// The `Template` parts of a key, value or content node
export const templateParts = (node) => node?.parts?.filter(part => part.type === 'Template') ?? []
