import rule from '../lib/rules/window-open-noopener.js'
import {jsx, svelte} from './testers.js'

const missing = output => ({messageId: 'missingNoopener', suggestions: output === undefined ? [] : [{messageId: 'addNoopener', output}]})

jsx.run('window-open-noopener', rule, {
  valid: [
    {name: 'noopener', code: 'window.open(url, \'_blank\', \'noopener\')'},
    {name: 'noreferrer implies noopener', code: 'window.open(url, \'_blank\', \'noreferrer\')'},
    {name: 'among other features', code: 'window.open(url, \'_blank\', \'width=400, noopener, noreferrer\')'},
    {name: 'noopener=yes', code: 'window.open(url, \'_blank\', \'noopener=yes\')'},
    {name: 'noopener=1', code: 'window.open(url, \'_blank\', \'noopener=1\')'},
    {name: 'same context', code: 'window.open(url, \'_self\')'},
    {name: '_top', code: 'open(url, \'_top\')'},
    {name: 'dynamic features are trusted', code: 'window.open(url, \'_blank\', features)'},
    {name: 'spread arguments', code: 'window.open(...args)'},
    {name: 'local open', code: 'const open = () => {}; open(url)'},
    {name: 'local window', code: 'function f(window) { window.open(url) }'},
    {name: 'unrelated member', code: 'dialog.open(url)'},
    {name: 'file open', code: 'fs.open(path, \'r\')'},
    {name: 'relative url', code: 'window.open(\'/help\')'},
    {name: 'relative file', code: 'window.open(\'help.html\', \'help\', \'width=400\')'},
    {name: 'relative template head', code: 'window.open(`/orders/${ id }`)'},
    {name: 'location.origin template', code: 'window.open(`${ location.origin }/auth/login`, \'login\', \'width=600\')'},
    {name: 'window.location.origin concatenation', code: 'window.open(window.location.origin + \'/auth\')'},
    {name: 'both branches relative', code: 'window.open(admin ? \'/admin\' : \'/\')'},
  ],
  invalid: [
    {
      name: 'no features',
      code: 'window.open(url, \'_blank\')',
      errors: [missing('window.open(url, \'_blank\', \'noopener\')')],
    },
    {
      name: 'no target defaults to _blank',
      code: 'window.open(url)',
      errors: [missing('window.open(url, \'_blank\', \'noopener\')')],
    },
    {
      name: 'no arguments',
      code: 'window.open()',
      errors: [missing('window.open(undefined, \'_blank\', \'noopener\')')],
    },
    {
      name: 'features without noopener keep their value',
      code: 'window.open(url, \'_blank\', "width=400")',
      errors: [missing('window.open(url, \'_blank\', "width=400,noopener")')],
    },
    {
      name: 'noopener=0 is off',
      code: 'window.open(url, \'_blank\', \'noopener=0\')',
      errors: [missing('window.open(url, \'_blank\', \'noopener=0,noopener\')')],
    },
    {
      name: 'dynamic target',
      code: 'window.open(url, target)',
      errors: [missing('window.open(url, target, \'noopener\')')],
    },
    {name: 'bare open', code: 'open(url)', errors: [missing('open(url, \'_blank\', \'noopener\')')]},
    {name: 'globalThis', code: 'globalThis.open(url)', errors: [missing('globalThis.open(url, \'_blank\', \'noopener\')')]},
    {name: 'computed member', code: 'window[\'open\'](url)', errors: [missing('window[\'open\'](url, \'_blank\', \'noopener\')')]},
    {name: 'absolute url', code: 'window.open(\'https://x.com\')', errors: [missing('window.open(\'https://x.com\', \'_blank\', \'noopener\')')]},
    {name: 'protocol-relative url', code: 'window.open(\'//x.com\')', errors: [missing('window.open(\'//x.com\', \'_blank\', \'noopener\')')]},
    {name: 'unknown template head', code: 'window.open(`${ host }/x`)', errors: [missing('window.open(`${ host }/x`, \'_blank\', \'noopener\')')]},
    {name: 'one absolute branch', code: 'window.open(ok ? \'/a\' : \'https://x.com\')', errors: [missing('window.open(ok ? \'/a\' : \'https://x.com\', \'_blank\', \'noopener\')')]},
    {name: 'empty url is about:blank', code: 'window.open(\'\')', errors: [missing('window.open(\'\', \'_blank\', \'noopener\')')]},
    {
      name: 'no suggestion when the returned handle is used',
      code: 'const popup = window.open(url)',
      errors: [missing()],
    },
  ],
})

svelte.run('window-open-noopener (svelte)', rule, {
  valid: [
    {name: 'noopener', code: '<script>window.open(url, \'_blank\', \'noopener\')</script>'},
  ],
  invalid: [
    {
      name: 'in the instance script',
      code: '<script>\n  function share() {\n    window.open(url)\n  }\n</script>\n<button onclick={share}>Share</button>',
      errors: [missing('<script>\n  function share() {\n    window.open(url, \'_blank\', \'noopener\')\n  }\n</script>\n<button onclick={share}>Share</button>')],
    },
    {
      name: 'in a template handler, returning the handle',
      code: '<button onclick={() => window.open(url)}>Share</button>',
      errors: [missing()],
    },
  ],
})
