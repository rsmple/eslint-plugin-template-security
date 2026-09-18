import assert from 'node:assert/strict'
import {readdir} from 'node:fs/promises'
import {test} from 'node:test'
import plugin from '../lib/index.js'

test('every rule file is registered and enabled in recommended', async () => {
  const files = await readdir(new URL('../lib/rules/', import.meta.url))
  const names = files.filter(file => file.endsWith('.js')).map(file => file.slice(0, -3)).sort()

  assert.deepEqual(Object.keys(plugin.rules).sort(), names)
  assert.deepEqual(Object.keys(plugin.configs.recommended.rules).sort(), names.map(name => `template-security/${ name }`))
})

test('every rule links to its README section', () => {
  for (const [name, rule] of Object.entries(plugin.rules)) {
    assert.equal(rule.meta.docs.url, `https://github.com/rsmple/eslint-plugin-template-security#${ name }`)
  }
})
