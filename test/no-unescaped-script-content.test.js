import rule from '../lib/rules/no-unescaped-script-content.js'
import {astro, jsx, svelte} from './testers.js'

const ESCAPE = '.replace(/</g, \'\\\\u003c\')'

const unescaped = (sink, output) => ({
  messageId: 'unescaped',
  data: {sink, escape: ESCAPE, escapers: '`serialize()`, `uneval()`, `devalue.uneval()`'},
  suggestions: output === undefined ? [] : [{messageId: 'escapeLt', output}],
})

astro.run('no-unescaped-script-content (astro)', rule, {
  valid: [
    {name: 'escaped JSON', code: '<script type="application/ld+json" set:html={JSON.stringify(data).replace(/</g, \'\\\\u003c\')} />'},
    {name: 'replaceAll', code: '<script set:html={JSON.stringify(data).replaceAll(\'<\', \'\\\\u003c\')} />'},
    {name: 'character class', code: '<script set:html={JSON.stringify(data).replace(/[<>&]/g, escape)} />'},
    {name: 'escape earlier in the chain', code: '<script set:html={JSON.stringify(data).replace(/</g, \'\\\\u003c\').replace(/>/g, \'\\\\u003e\')} />'},
    {name: 'serialize-javascript', code: '<script set:html={serialize(state)} />'},
    {name: 'devalue', code: '<script set:html={devalue.uneval(state)} />'},
    {name: 'constant', code: '<script set:html="window.x = 1" />'},
    {name: 'both branches safe', code: '<script set:html={ok ? serialize(state) : \'null\'} />'},
    {name: 'not a script', code: '<div set:html={JSON.stringify(data)} />'},
    {name: 'style is out of scope', code: '<style set:html={css} />'},
    {name: 'custom escaper', options: [{escapers: ['htmlSafeJson']}], code: '<script set:html={htmlSafeJson(data)} />'},
  ],
  invalid: [
    {
      name: 'JSON-LD',
      code: '<script type="application/ld+json" set:html={JSON.stringify(item)} />',
      errors: [unescaped('set:html', `<script type="application/ld+json" set:html={JSON.stringify(item)${ ESCAPE }} />`)],
    },
    {
      name: 'is:inline state',
      code: '<script is:inline set:html={`window.__STATE__ = ${ JSON.stringify(state) }`} />',
      errors: [unescaped('set:html')],
    },
    {name: 'variable', code: '<script set:html={code} />', errors: [unescaped('set:html')]},
    {
      name: 'replace without g misses later tags',
      code: '<script set:html={JSON.stringify(data).replace(/</, \'\\\\u003c\')} />',
      errors: [unescaped('set:html')],
    },
    {
      name: 'only </script> escaped',
      code: '<script set:html={JSON.stringify(data).replace(/<\\/script/gi, \'<\\\\/script\')} />',
      errors: [unescaped('set:html')],
    },
    {
      name: 'replace() with a string pattern only replaces the first',
      code: '<script set:html={JSON.stringify(data).replace(\'<\', \'\\\\u003c\')} />',
      errors: [unescaped('set:html')],
    },
    {name: 'one unsafe branch', code: '<script set:html={ok ? serialize(state) : raw} />', errors: [unescaped('set:html')]},
    {
      name: 'defaults are replaced, not merged',
      options: [{escapers: ['htmlSafeJson']}],
      code: '<script set:html={serialize(state)} />',
      errors: [{messageId: 'unescaped', data: {sink: 'set:html', escape: ESCAPE, escapers: '`htmlSafeJson()`'}, suggestions: []}],
    },
  ],
})

jsx.run('no-unescaped-script-content (jsx)', rule, {
  valid: [
    {name: 'escaped __html', code: '<script dangerouslySetInnerHTML={{__html: JSON.stringify(data).replace(/</g, \'\\\\u003c\')}} />'},
    {name: 'text child is escaped by React', code: '<script>{JSON.stringify(data)}</script>'},
    {name: 'not a script', code: '<div dangerouslySetInnerHTML={{__html: JSON.stringify(data)}} />'},
  ],
  invalid: [
    {
      name: '__html',
      code: '<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(data)}} />',
      errors: [unescaped('dangerouslySetInnerHTML', `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(data)${ ESCAPE }}} />`)],
    },
    {
      name: 'Next.js <Script>',
      code: '<Script id="state" dangerouslySetInnerHTML={{__html: `window.s = ${ JSON.stringify(s) }`}} />',
      errors: [unescaped('dangerouslySetInnerHTML')],
    },
    {name: 'Solid innerHTML', code: '<script innerHTML={JSON.stringify(data)} />', errors: [unescaped('innerHTML', `<script innerHTML={JSON.stringify(data)${ ESCAPE }} />`)]},
  ],
})

const JSON_LD = '<script type="application/ld+json">'

svelte.run('no-unescaped-script-content (svelte)', rule, {
  valid: [
    {name: 'escaped JSON-LD', code: `<svelte:head>{@html \`${ JSON_LD }\${ JSON.stringify(data)${ ESCAPE } }</script>\`}</svelte:head>`},
    {name: 'serialize', code: `<svelte:head>{@html \`${ JSON_LD }\${ serialize(data) }</script>\`}</svelte:head>`},
    {name: 'interpolation after the script closes', code: '{@html `<script>init()</script><p>${ text }</p>`}'},
    {name: 'interpolation in the opening tag', code: '{@html `<script nonce="${ nonce }">init()</script>`}'},
    {name: 'plain html', code: '{@html html}'},
  ],
  invalid: [
    {
      name: 'JSON-LD through {@html}',
      code: `<svelte:head>{@html \`${ JSON_LD }\${ JSON.stringify(data) }</script>\`}</svelte:head>`,
      errors: [unescaped('{@html}', `<svelte:head>{@html \`${ JSON_LD }\${ JSON.stringify(data)${ ESCAPE } }</script>\`}</svelte:head>`)],
    },
    {
      name: 'concatenation',
      code: `{@html '${ JSON_LD }' + JSON.stringify(data) + '</' + 'script>'}`,
      errors: [unescaped('{@html}', `{@html '${ JSON_LD }' + JSON.stringify(data)${ ESCAPE } + '</' + 'script>'}`)],
    },
    {name: 'variable', code: '{@html `<script>window.state = ${ state }</script>`}', errors: [unescaped('{@html}')]},
  ],
})

jsx.run('no-unescaped-script-content (jsx, built script)', rule, {
  valid: [
    {name: 'escaped', code: `<div dangerouslySetInnerHTML={{__html: \`<script>\${ JSON.stringify(x)${ ESCAPE } }</script>\`}} />`},
  ],
  invalid: [
    {
      name: '__html builds a script',
      code: '<div dangerouslySetInnerHTML={{__html: `<script>${ JSON.stringify(x) }</script>`}} />',
      errors: [unescaped('dangerouslySetInnerHTML', `<div dangerouslySetInnerHTML={{__html: \`<script>\${ JSON.stringify(x)${ ESCAPE } }</script>\`}} />`)],
    },
  ],
})
