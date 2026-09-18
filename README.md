# eslint-plugin-template-security

[![npm](https://img.shields.io/npm/v/eslint-plugin-template-security)](https://www.npmjs.com/package/eslint-plugin-template-security)
[![CI](https://github.com/rsmple/eslint-plugin-template-security/actions/workflows/ci.yml/badge.svg)](https://github.com/rsmple/eslint-plugin-template-security/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/rsmple/eslint-plugin-template-security)](./LICENSE)

Security rules for **template bindings**, written once and applied to every
template syntax ESLint can parse:

| Syntax | Parser | Covers |
| --- | --- | --- |
| JSX | default (`ecmaFeatures.jsx`) or `@typescript-eslint/parser` | React, Preact, Solid |
| Astro | `astro-eslint-parser` | `.astro` components |
| Vue | `vue-eslint-parser` | SFC templates |

Security plugins mostly look at JavaScript — `element.innerHTML = x`,
`postMessage(x, '*')`. The same sinks written in a template (`v-html`,
`set:html`, `:href`, `target="_blank"`) are a different AST in every framework,
and each framework plugin covers a different subset of them, if any. This plugin
reads them all through one adapter, so a rule behaves the same in a `.vue`,
`.astro` and `.tsx` file.

It pairs with JavaScript-level plugins such as
[`eslint-plugin-no-unsanitized`](https://github.com/mozilla/eslint-plugin-no-unsanitized)
rather than replacing them.

## Install

```sh
npm i -D eslint-plugin-template-security
```

ESLint 9+, flat config. The plugin brings no parser; it uses whichever one your
config already sets for each file type.

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
| [`no-unescaped-script-content`](#no-unescaped-script-content) | 💡 suggestion |
| [`no-unsafe-html`](#no-unsafe-html) | |
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
| Vue `v-html` | compiler error, children dropped |
| Solid `innerHTML` | children rendered, then overwritten |
| Astro `set:html` | children dropped without a warning |

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
normalized the way browsers do.

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

Reports `http:` URLs the page loads or submits to:

| Element | Attribute |
| --- | --- |
| `<script>` (and Next.js `<Script>`) | `src` |
| `<iframe>`, `<frame>`, `<embed>` | `src` |
| `<object>` | `data` |
| `<link>` with `rel` `stylesheet`, `preload`, `modulepreload`, `prefetch` or `manifest` | `href` |
| `<form>` | `action` |
| `<button>`, `<input>` | `formaction` |

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

The suggestion switches the URL to `https:`. It is not an autofix because the
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
| Solid, Vue | `innerHTML={x}`, `:innerHTML`, `v-bind:inner-html.prop` |
| Vue | `v-html` |
| Astro | `set:html` |
| All | `<iframe srcdoc>` (`srcDoc` in React) |

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

| Option | Default | |
| --- | --- | --- |
| `sanitizers` | `['DOMPurify.sanitize', 'sanitizeHtml']` | Callee names that count as sanitizing. Replaces the default list. |

`<script>` and `<style>` are skipped: their content is raw text, not HTML, so
an HTML sanitizer is the wrong tool there. `<script>` is covered by
[`no-unescaped-script-content`](#no-unescaped-script-content).

The sanitizer check is by name: it trusts that a function called
`sanitizeHtml` sanitizes. HTML your own build renders (markdown, trusted CMS)
is a legitimate use — disable the rule on that line with a comment saying where
the HTML comes from.

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
  trustedHosts: ['www.googletagmanager.com', '*.stripe.com'],
}]
```

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
`_self` / `_parent` / `_top` targets and a bound features string.

With `noopener`, `window.open()` returns `null`. The suggestion is therefore
only offered when the return value is unused; code that keeps the handle has to
choose between the handle and the isolation.

## Limitations

- Svelte, Angular templates and plain `.html` files are not covered yet — the
  adapter layer is built for them to be added.
- Bindings into `<style>` are not checked. Generated CSS is common and rarely
  carries user input, so reporting every one of them would mostly be noise.
- Values are resolved within the attribute only; a URL built in a variable
  elsewhere is treated as unknown (external, for `link-noopener`).

## License

MIT
