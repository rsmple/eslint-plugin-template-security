import rule from '../lib/rules/window-open-noopener.js'
import {jsx} from './testers.js'

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
    {
      name: 'no suggestion when the returned handle is used',
      code: 'const popup = window.open(url)',
      errors: [missing()],
    },
  ],
})
