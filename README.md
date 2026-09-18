# eslint-plugin-template-security

[![npm](https://img.shields.io/npm/v/eslint-plugin-template-security)](https://www.npmjs.com/package/eslint-plugin-template-security)
[![CI](https://github.com/rsmple/eslint-plugin-template-security/actions/workflows/ci.yml/badge.svg)](https://github.com/rsmple/eslint-plugin-template-security/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/rsmple/eslint-plugin-template-security)](./LICENSE)

Security rules for **template bindings**, written once and applied to every
template syntax ESLint can parse:

| Syntax | Parser | Covers |
| --- | --- | --- |
| JSX | default (`ecmaFeatures.jsx`) or `@typescript-eslint/parser` | React, Preact, Solid, Qwik |
| MDX | `eslint-mdx` | JSX in `.mdx` documents |
| Astro | `astro-eslint-parser` | `.astro` components |
| Vue | `vue-eslint-parser` | SFC templates |
| Svelte | `svelte-eslint-parser` | `.svelte` components |
| HTML | `@html-eslint/parser` | `.html` files, and [server templates](#server-templates): Jinja, Django, Nunjucks, Twig, Blade, ERB, EJS, Handlebars, PHP, JSP, Liquid |

[htmx](https://htmx.org) and [Alpine.js](https://alpinejs.dev) attributes
(`hx-get`, `x-html`) are checked in all of them.

Security plugins mostly look at JavaScript — `element.innerHTML = x`,
`postMessage(x, '*')`. The same sinks written in a template (`v-html`,
`set:html`, `{@html}`, `:href`, `target="_blank"`) are a different AST in every
framework, and each framework plugin covers a different subset of them, if any.
This plugin reads them all through one adapter, so a rule behaves the same in a
`.vue`, `.svelte`, `.astro`, `.html` and `.tsx` file.

It pairs with JavaScript-level plugins such as
[`eslint-plugin-no-unsanitized`](https://github.com/mozilla/eslint-plugin-no-unsanitized)
rather than replacing them.

## Install

```sh
npm i -D eslint-plugin-template-security
```

ESLint 9+, flat config. The plugin brings no parser; it uses whichever one your
config already sets for each file type. For plain HTML, for example:

```js
import htmlParser from '@html-eslint/parser'
import templateSecurity from 'eslint-plugin-template-security'

export default [
  templateSecurity.configs.recommended,
  {files: ['**/*.html'], languageOptions: {parser: htmlParser}},
]
```

In HTML files the rules check what is written in the markup: URLs, `target`,
`sandbox`, `integrity`. Inline `<script>` content is not parsed as JavaScript
there, so `window-open-noopener` does not run on it. With a template engine
configured, a `{{ … }}` part of a value is treated like a bound expression.

### Server templates

Server templates are HTML with a template engine's tags in it, so they use the
same parser with the engine's delimiters. The plugin exports those for each
engine, and a setting tells the rules which engine it is:

```js
import htmlParser from '@html-eslint/parser'
import templateSecurity, {templateEngineSyntax} from 'eslint-plugin-template-security'

export default [
  templateSecurity.configs.recommended,
  {
    files: ['**/templates/**/*.html'],
    languageOptions: {parser: htmlParser, parserOptions: {templateEngineSyntax: templateEngineSyntax.jinja}},
    settings: {'template-security': {engine: 'jinja'}},
  },
]
```

| `engine` | For | Found from the file name |
| --- | --- | --- |
| `jinja` | Jinja2, Django, Nunjucks | `.j2`, `.jinja`, `.jinja2`, `.njk`, `.nunjucks` |
| `twig` | Twig, Drupal, Symfony | `.twig` |
| `blade` | Laravel Blade | `.blade.php` |
| `erb` | Rails ERB | `.erb` |
| `ejs` | EJS | `.ejs` |
| `handlebars` | Handlebars, Mustache | `.hbs`, `.handlebars`, `.mustache` |
| `php` | plain PHP templates, WordPress themes | `.php`, `.phtml` |
| `jsp` | JSP | `.jsp`, `.jspx`, `.tag` |
| `liquid` | Liquid (Shopify, Jekyll) | `.liquid` |

For other file names, such as Django's `.html`, the setting names the engine.
Without either, the rules only rely on syntax the engines share.

Autoescaping in these engines escapes HTML text. It knows nothing about where
the value lands, so a value escaped for text can still run as JavaScript in an
`onclick`, a `<script>` or an Alpine `x-data`.
[`no-unsafe-output-context`](#no-unsafe-output-context) reports those places,
and [`no-unescaped-output`](#no-unescaped-output) reports output that skips
escaping altogether.

## Usage

```js
// eslint.config.js
import templateSecurity from 'eslint-plugin-template-security'

export default [
  templateSecurity.configs.recommended,
]
```

`recommended` enables every rule as `error`.

## Rules

| Rule | Fixable |
| --- | --- |
| [`link-noopener`](#link-noopener) | 🔧 fix |
| [`no-html-with-children`](#no-html-with-children) | |
| [`no-javascript-url`](#no-javascript-url) | |
| [`no-mixed-content`](#no-mixed-content) | 💡 suggestion |
| [`no-sandbox-escape`](#no-sandbox-escape) | |
| [`no-unescaped-output`](#no-unescaped-output) | |
| [`no-unescaped-script-content`](#no-unescaped-script-content) | 💡 suggestion |
| [`no-unsafe-html`](#no-unsafe-html) | |
| [`no-unsafe-output-context`](#no-unsafe-output-context) | 🔧 fix |
| [`require-sri`](#require-sri) | |
| [`window-open-noopener`](#window-open-noopener) | 💡 suggestion |

### `link-noopener`

A link that opens a new browsing context gives the opened page a
`window.opener` handle, which it can use to navigate your page to a phishing
copy. Browsers imply `noopener` for `target="_blank"` since 2021, but not for
**named targets** (`target="docs"`), which this rule also checks.

Reports `<a>`, `<area>` and `<form>` with a `target` other than
`_self` / `_parent` / `_top`, an external or bound URL, and no `noopener` or
`noreferrer` in `rel`.

```vue
<!-- ✗ -->
<a :href="url" target="_blank">Docs</a>
<a href="https://github.com/me" target="_blank" rel="me">GitHub</a>

<!-- ✓ -->
<a :href="url" target="_blank" rel="noopener">Docs</a>
<a href="/pricing" target="_blank">Pricing</a>
```

The autofix adds `rel="noopener"`, or appends to an existing `rel`.

A bound `target` is assumed to open a new window. A bound `rel` is trusted,
and so is a spread (`{...props}`, `v-bind="attrs"`) when `rel` is absent, since
the rule cannot see into either.

| Option | Default | |
| --- | --- | --- |
| `components` | `{}` | Link components to check, as `{Name: 'urlProp'}`. `PascalCase` and `kebab-case` match each other. |
| `noreferrer` | `false` | Also require `noreferrer`, so the linked site does not receive this page's URL. |
| `dynamicLinks` | `true` | Treat a bound URL as external. |

```js
'template-security/link-noopener': ['error', {
  components: {RouterLink: 'href', Button: 'href'},
  noreferrer: true,
}]
```

### `no-html-with-children`

An HTML binding replaces the element's whole content, so children written in
the template never render. The page does not show the markup the template
suggests, and a fallback or escaped version there is silently discarded.

| Syntax | With children |
| --- | --- |
| React | throws at render |
| Qwik | error logged in development, children dropped |
| Vue `v-html` | compiler error, children dropped |
| Solid `innerHTML` | children rendered, then overwritten |
| Astro `set:html` | children dropped without a warning |
| Svelte `bind:innerHTML` | children rendered, then overwritten unless the bound value is empty |
| Alpine `x-html` | children rendered, then overwritten when Alpine starts |

```astro
<!-- ✗ -->
<article set:html={post.html}>
  <p>Loading…</p>
</article>

<!-- ✓ -->
<article set:html={post.html} />
```

Whitespace and comments do not count as children. A JSX `children` prop
does. For `v-html` this overlaps with `vue/no-child-content` from
`eslint-plugin-vue`.

### `no-javascript-url`

Reports `javascript:` URLs in `href`, `src`, `action`, `formaction`,
`xlink:href`, `poster`, `data` and `cite`, whether written as a string, a bound
literal, or the known prefix of a template string, concatenation or
conditional. Leading whitespace and tabs or newlines inside the scheme are
normalized the way browsers do. So are character references in HTML and in
static Astro attributes (`javascript&colon;`, `&#106;avascript:`), which the
browser decodes before reading the URL. JSX string attributes are not decoded:
React sets them on the DOM unchanged.

```jsx
// ✗
<a href="javascript:void(0)" onClick={open}>Open</a>
<a href={ok ? url : 'javascript:;'}>Open</a>

// ✓
<button type="button" onClick={open}>Open</button>
```

| Option | Default | |
| --- | --- | --- |
| `attributes` | `[]` | Extra attribute names holding a URL, e.g. `['to']`. |

### `no-mixed-content`

Reports `http:` and `ws:` URLs the page loads or submits to:

| Element | Attribute |
| --- | --- |
| `<script>` (and Next.js `<Script>`) | `src` |
| `<iframe>`, `<frame>`, `<embed>` | `src` |
| `<object>` | `data` |
| `<link>` with `rel` `stylesheet`, `preload`, `modulepreload`, `prefetch` or `manifest` | `href` |
| `<form>` | `action` |
| `<button>`, `<input>` | `formaction` |
| any element | htmx `hx-get`, `hx-post`, `hx-put`, `hx-patch`, `hx-delete` (and `data-hx-*`), `sse-connect`, `ws-connect` |

On an HTTPS page the browser blocks these requests, or warns before a form is
submitted. Anywhere, anyone on the network path can read the request and change
the response. That means the page runs a script or submits a form that someone
else controls.

```html
<!-- ✗ -->
<script src="http://cdn.example.com/widget.js"></script>
<form action="http://api.example.com/subscribe">

<!-- ✓ -->
<script src="https://cdn.example.com/widget.js"></script>
<script src="http://localhost:5173/@vite/client"></script>
```

Loopback hosts (`localhost`, `*.localhost`, `127.x.x.x`, `[::1]`) are not
reported, because browsers treat them as secure. Neither are images, audio and
video, which browsers upgrade to `https:` themselves, or `<a href>`, which is a
navigation rather than a load. A bound URL is reported when it is known to start
with `http:`: a template head, a concatenation, or a conditional branch.

The suggestion switches the URL to `https:` (`wss:` for `ws:`). It is not an autofix because the
host may not serve HTTPS.

### `no-sandbox-escape`

A document in a sandboxed frame that is allowed both `allow-scripts` and
`allow-same-origin` can run code with the embedding page's origin. When that
origin is the page's own, the code can reach `window.parent`, remove the
`sandbox` attribute and reload itself, so the sandbox restricts nothing.

Reports an `<iframe>` whose `sandbox` lists both tokens and whose document has
the page's origin: `srcdoc`, no `src` (`about:blank`), a relative or `blob:`
URL, or a bound `src` that is not known to start with another origin.

```jsx
// ✗
<iframe srcDoc={preview} sandbox="allow-scripts allow-same-origin" />
<iframe src="/widget" sandbox="allow-scripts allow-same-origin" />

// ✓
<iframe srcDoc={preview} sandbox="allow-scripts" />
<iframe src="https://codesandbox.io/embed/x" sandbox="allow-scripts allow-same-origin" />
```

For a frame from another origin, the combination only gives that site its own
origin back. That is the usual setting for embeds, so it is not reported. An
absolute `https:` URL is always treated as another origin, even when it points
to this site. A bound `sandbox` is not checked, and neither is a frame with a
spread and no visible `src`.

### `no-unescaped-output`

Reports [server template](#server-templates) output that skips HTML escaping,
in text, attribute values and `<style>`:

| Engine | Unescaped |
| --- | --- |
| Jinja, Django, Nunjucks | `{{ x\|safe }}`, `{% autoescape false %}` / `off` |
| Twig | `{{ x\|raw }}`, `{% autoescape false %}` |
| Blade | `{!! x !!}` |
| Handlebars, Mustache | `{{{ x }}}`, `{{& x }}` |
| ERB | `<%== x %>`, `raw x`, `x.html_safe` |
| EJS | `<%- x %>` |
| PHP | every `<?= x ?>` and `<?php echo x ?>` |
| JSP | every `${x}` and `<%= x %>` outside a tag library's attributes |

```django
{# ✗ #}
<div>{{ comment.body|safe }}</div>

{# ✓ #}
<div>{{ comment.body }}</div>
<div>{{ comment.body|bleach|safe }}</div>  {# with sanitizers: ['bleach'] #}
```

Output is not reported when it is a fixed string, or passes through an escaper,
sanitizer or helper that builds its own markup: `htmlspecialchars()`, `e()`,
`esc_html()`, `fn:escapeXml()`, `|escape`, `sanitize()`, `csrf_field()`,
`->links()`, EJS `include()`. Neither is a layout's `{{{body}}}` /
`<%- body %>`. The check is by name. Output inside `<script>`, event handlers
and attribute names is left to
[`no-unsafe-output-context`](#no-unsafe-output-context), because escaping is
the wrong fix there.

Liquid is not checked: it escapes nothing unless told to, so every output would
be reported. For WordPress, the PHP_CodeSniffer rule
`WordPress.Security.EscapeOutput` understands PHP and knows WordPress's own
functions; this rule is a lighter check for templates.

| Option | Default | |
| --- | --- | --- |
| `sanitizers` | `[]` | More call and filter names whose output is safe HTML. Added to the built-in list. |

### `no-unescaped-script-content`

The HTML parser reads a `<script>` element's content as raw text up to the
first `</script>`, whatever JavaScript or JSON string it appears in. A value
written into a script (JSON-LD, serialized state) that contains `</script>`
therefore closes the element early, and the rest is parsed as HTML: a
`<script>` of the attacker's own, for example. `JSON.stringify` does not escape
`<`.

Reports `set:html`, `dangerouslySetInnerHTML`, `innerHTML` and `v-html` on
`<script>` (and Next.js `<Script>`) unless the value is a constant, escapes
every `<` with `.replace(/</g, …)` / `.replaceAll('<', …)`, or is passed to an
escaper.

```astro
<!-- ✗ -->
<script type="application/ld+json" set:html={JSON.stringify(schema)} />

<!-- ✓ -->
<script type="application/ld+json" set:html={JSON.stringify(schema).replace(/</g, '\\u003c')} />
```

In JSON, `<` only occurs inside strings, where `<` decodes back to `<`, so
the escaped value parses to the same data. The suggestion adds this escape when
the value is a `JSON.stringify()` call. It is not an autofix because
`JSON.stringify(undefined)` returns `undefined`, and `.replace` would then throw.

It also checks HTML that builds its own `<script>`. Svelte does not allow
`{…}` inside a `<script>` in markup, so JSON-LD there is usually written as
`{@html}` around a template string. The interpolations inside the `<script>`
element have to be escaped the same way:

```svelte
<!-- ✗ -->
<svelte:head>
  {@html `<script type="application/ld+json">${JSON.stringify(schema)}</script>`}
</svelte:head>

<!-- ✓ -->
<svelte:head>
  {@html `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`}
</svelte:head>
```

The same applies to `__html`, `set:html` or `v-html` built from a template
string or `+` concatenation. `no-unsafe-html` then checks only the
interpolations outside the `<script>`.

A replace that only matches `</script` does not count: `<!--` inside a script
also changes how the parser reads the rest of it.

| Option | Default | |
| --- | --- | --- |
| `escapers` | `['serialize', 'uneval', 'devalue.uneval']` | Callee names whose output is safe inside `<script>` ([serialize-javascript](https://github.com/yahoo/serialize-javascript), [devalue](https://github.com/sveltejs/devalue)). Replaces the default list. |

### `no-unsafe-html`

Reports HTML sinks bound to anything other than a constant or a sanitizer call:

| Syntax | Sink |
| --- | --- |
| React, Preact | `dangerouslySetInnerHTML={{__html: x}}` |
| Qwik | `dangerouslySetInnerHTML={x}` |
| Solid, Vue | `innerHTML={x}`, `:innerHTML`, `v-bind:inner-html.prop` |
| Vue | `v-html` |
| Astro | `set:html` |
| Svelte | `{@html x}`, `bind:innerHTML` |
| Alpine | `x-html="x"` |
| All | `<iframe srcdoc>` (`srcDoc` in React) |
| htmx | `hx-get` and the other request attributes, with a URL on another origin |

In Svelte, `innerHTML={x}` sets an inert `innerhtml` attribute rather than the
property, so only `bind:innerHTML` counts. A template string is checked by
its interpolations: `` {@html `<p>${DOMPurify.sanitize(x)}</p>`} `` passes.

Alpine's `x-html` holds JavaScript that Alpine evaluates, not the HTML itself.
It passes when that code is a single string literal or a single sanitizer call
(`x-html="DOMPurify.sanitize(post.body)"`), and anything else is reported.

```vue
<!-- ✗ -->
<div v-html="comment.body" />

<!-- ✓ -->
<div v-html="DOMPurify.sanitize(comment.body)" />
<div>{{ comment.body }}</div>
```

A `srcdoc` document runs in the embedding page's origin, so its scripts can
read your cookies and DOM. A frame with a static `sandbox` attribute is not
reported, because the sandbox either blocks scripts or moves the document to an
opaque origin. The exception is a `sandbox` that lists both `allow-scripts` and
`allow-same-origin`: the framed scripts can then remove the sandbox. A bound
`sandbox` is not trusted.

```vue
<!-- ✗ -->
<iframe :srcdoc="email.html" />

<!-- ✓ -->
<iframe sandbox :srcdoc="email.html" />
<iframe sandbox="allow-scripts" :srcdoc="preview" />
```

htmx inserts the HTML a request returns into the page, so an `hx-get` (or
`hx-post`, `hx-put`, `hx-patch`, `hx-delete`) to another origin lets that host
run scripts in your page. htmx's own
[security essay](https://htmx.org/essays/web-security-basics-with-htmx/) gives
the same rule: only call routes you control. A URL is reported when it is known to have a host,
static or as a template head, and that host is not in `trustedHosts`. A relative
or fully bound URL is not, and neither is an element with `hx-swap="none"`,
which discards the response. htmx 2 blocks these requests by default
(`htmx.config.selfRequestsOnly`); htmx 1 and apps that turn that off send them.

```html
<!-- ✗ -->
<div hx-get="https://widgets.example.net/feed"></div>

<!-- ✓ -->
<div hx-get="/feed"></div>
```

| Option | Default | |
| --- | --- | --- |
| `sanitizers` | `['DOMPurify.sanitize', 'sanitizeHtml']` | Callee names that count as sanitizing. Replaces the default list. |
| `trustedHosts` | `[]` | Hosts whose HTML htmx may insert, such as your own API's host. `*.example.com` matches subdomains, not `example.com` itself. |

`<script>` and `<style>` are skipped: their content is raw text, not HTML, so
an HTML sanitizer is the wrong tool there. `<script>` is covered by
[`no-unescaped-script-content`](#no-unescaped-script-content).

The sanitizer check is by name: it trusts that a function called
`sanitizeHtml` sanitizes. HTML your own build renders (markdown, trusted CMS)
is a legitimate use — disable the rule on that line with a comment saying where
the HTML comes from.

### `no-unsafe-output-context`

Reports [server template](#server-templates) output in places where the
engine's HTML escaping does not make it safe:

| Where | Why escaping does not help |
| --- | --- |
| `<script>` content | Not HTML: `var id = {{ id }}` needs no quote to inject code, and `\` can end a string |
| Event handlers (`onclick`), htmx `hx-on:*` and `hx-vals="js:…"`, Alpine `x-*` / `@*` / `:*`, Knockout `data-bind` | The browser decodes `&#39;` back to `'` before running the code |
| `srcdoc` | Decoded, then parsed as a document: escaped markup becomes markup again |
| Unquoted values: `value={{ v }}` | Spaces are not escaped, so the output can add `onfocus=…` |
| Attribute names: `<div {{ attrs }}>` | The output writes attributes, event handlers included |
| The start of `href`, `src`, `action` (with `urls: true`) | `javascript:` has nothing to escape |

```django
{# ✗ #}
<script>const user = "{{ user.name }}"</script>
<button onclick="remove('{{ item.name }}')">Remove</button>

{# ✓ #}
<script>const user = {{ user.name|tojson }}</script>
<button data-name="{{ item.name }}" onclick="remove(this.dataset.name)">Remove</button>
```

Output passes when it is a fixed string (`{{ 'a' if x else 'b' }}`), or goes
through a JavaScript escaper: `|tojson` (Jinja), `|escapejs` (Django),
`|e('js')` (Twig), `Js::from()` (Laravel), `j` / `escape_javascript` /
`json_escape` (Rails), `json_encode(…, JSON_HEX_TAG)` / `esc_js()` (PHP),
`encodeForJavaScript()` (Java), or a number filter such as `|int`. Attribute
writers that escape each value, such as `|xmlattr`, Blade's `$attributes`,
Drupal's `attributes`, `shopify_attributes` and Symfony's `stimulus_*()`, may
write attribute names. `<script>` types that are not JavaScript or JSON, such as
`text/template`, are skipped.

The fix quotes an unquoted value.

The URL check is off by default. In real templates most URLs come from the
app's own routes and models (`{{ post.get_absolute_url }}`), which the rule
cannot tell apart from a URL a user typed in. Turn it on to review those places,
with the app's URL helpers listed as safe. `url_for()`, `route()`, `path()`,
`asset()`, `*_path` / `*_url` (Rails), `esc_url()` and `ALL_CAPS` settings
already count.

| Option | Default | |
| --- | --- | --- |
| `escapers` | `[]` | More call and filter names whose output is safe inside JavaScript. Added to the built-in list. |
| `urls` | `false` | Also report output at the start of a URL attribute. |
| `urlHelpers` | `[]` | More URL builders, for `urls`. Added to the built-in list. |

### `require-sri`

A script or stylesheet loaded from a CDN runs with this page's full access.
Whoever controls that host, or compromises it, controls the page.
[Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
pins the file to a hash, and the browser refuses to run anything else.

Reports `<script src>` (and Next.js `<Script>`) and `<link rel="stylesheet |
preload | modulepreload" href>` that load from another origin (`https:`,
`http:` or `//`) without `integrity`. Also reports `integrity` without
`crossorigin`. For another origin, the browser blocks the resource in that case.

```html
<!-- ✗ -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
<link rel="stylesheet" href="https://cdn.example.com/a.css" integrity="sha384-…">

<!-- ✓ -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"
  integrity="sha384-…" crossorigin="anonymous"></script>
<script src="/assets/app.js"></script>
```

Only URLs known to point elsewhere are checked. That includes a template or
conditional whose head names a host, but not a relative or unknown bound URL.
A bound `integrity` is trusted, and so is a spread when `integrity` is absent.
The rule cannot compute the hash, so there is no fix.

Some third-party scripts change by design and cannot be pinned, such as analytics
tags and payment SDKs (Stripe asks you not to). List those hosts to accept them:

| Option | Default | |
| --- | --- | --- |
| `trustedHosts` | `[]` | Hosts that need no `integrity`. `*.example.com` matches subdomains, not `example.com` itself. |

```js
'template-security/require-sri': ['error', {
  trustedHosts: ['www.googletagmanager.com', '*.stripe.com', 'fonts.googleapis.com'],
}]
```

Google Fonts' CSS is generated for each browser, so it has no fixed hash. The
font files it points to come from `fonts.gstatic.com` through the stylesheet,
not from the template, so this rule never sees them.

### `window-open-noopener`

`window.open()` opens a new browsing context with `window.opener` set unless
the features string contains `noopener` (or `noreferrer`). Unlike links,
browsers never made this the default.

```js
// ✗
window.open(paymentUrl)
window.open(url, '_blank', 'width=600')

// ✓
window.open(paymentUrl, '_blank', 'noopener')
window.open(url, '_blank', 'width=600,noopener')
```

Calls through a local `open` or `window` binding are ignored, as are
`_self` / `_parent` / `_top` targets and a bound features string. So are URLs
on this page's origin: a relative path, or one built from `location.origin`
(`` `${location.origin}/login` ``). The opened page is then this site's own.

With `noopener`, `window.open()` returns `null`. The suggestion is therefore
only offered when the return value is unused; code that keeps the handle has to
choose between the handle and the isolation.

## Limitations

- Angular templates are not covered. Angular sanitizes `[innerHTML]` and
  `javascript:` URLs itself, and its bypasses (`bypassSecurityTrustHtml()`)
  are TypeScript calls rather than template syntax.
- In MDX only the JSX is checked. Markdown syntax such as
  `[text](javascript:…)` is not JSX, and `eslint-mdx` does not expose it as
  nodes a rule can visit. `eslint-mdx` 3.8.1 also fails to parse a character
  reference (`&amp;`) inside a JSX attribute value.
- Server templates are read by `@html-eslint/parser`, which fails on some
  nesting: an output tag inside a comment (`{# {{ x }} #}`) or inside another
  tag's delimiters. In ten open-source projects that was 5 files of about 1,500.
  A JSP tag inside an attribute value (`href="<c:url …/>"`) is also misread.
- Go's `html/template` escapes by context, so it needs neither rule. Razor
  (`@x`) and Thymeleaf's attribute syntax (`th:utext`) are not supported.
- Bindings into `<style>` are not checked. Generated CSS is common and rarely
  carries user input, so reporting every one of them would mostly be noise.
- Values are resolved within the attribute only; a URL built in a variable
  elsewhere is treated as unknown (external, for `link-noopener`).

## License

MIT
