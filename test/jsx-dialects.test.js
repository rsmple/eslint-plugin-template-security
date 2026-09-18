// Qwik and MDX need no adapter of their own: both reach the rules as JSX. These
// lint a whole file with every rule and check which ones report on which line.
import assert from 'node:assert/strict'
import {test} from 'node:test'
import tsParser from '@typescript-eslint/parser'
import {Linter} from 'eslint'
import * as mdxParser from 'eslint-mdx'
import plugin from '../lib/index.js'

const linter = new Linter()

const lint = (code, filename, parser) => linter.verify(code, [{
  files: ['**/*.tsx', '**/*.mdx'],
  languageOptions: {parser, parserOptions: {ecmaFeatures: {jsx: true}}},
  plugins: {'template-security': plugin},
  rules: plugin.configs.recommended.rules,
}], filename).map(message => `${ message.line } ${ message.ruleId ?? message.message }`)

test('Qwik component', () => {
  const code = [
    'import {component$} from \'@builder.io/qwik\'',
    'export default component$((props: {html: string, url: string}) => (',
    '  <>',
    '    <div dangerouslySetInnerHTML={props.html} />',
    '    <div dangerouslySetInnerHTML={DOMPurify.sanitize(props.html)} />',
    '    <script type="application/ld+json" dangerouslySetInnerHTML={JSON.stringify(props)} />',
    '    <a href={props.url} target="_blank" onClick$={() => { window.open(props.url) }}>x</a>',
    '    <iframe srcdoc={props.html} sandbox="allow-scripts allow-same-origin" />',
    '    <div dangerouslySetInnerHTML={props.html}>child</div>',
    '  </>',
    '))',
  ].join('\n')

  assert.deepEqual(lint(code, 'app.tsx', tsParser), [
    '4 template-security/no-unsafe-html',
    '6 template-security/no-unescaped-script-content',
    '7 template-security/link-noopener',
    '7 template-security/window-open-noopener',
    '8 template-security/no-unsafe-html',
    '8 template-security/no-sandbox-escape',
    '9 template-security/no-html-with-children',
    '9 template-security/no-unsafe-html',
  ])
})

test('MDX document', () => {
  const code = [
    '# Title',
    '',
    'Text with <a href="https://x.com" target="_blank">inline JSX</a>.',
    '',
    '<div dangerouslySetInnerHTML={{__html: props.html}} />',
    '',
    '<script src="http://cdn.example.com/a.js"></script>',
    '',
    '<a href="javascript:void(0)">x</a>',
    '',
    '[markdown links are not JSX](javascript:alert(1))',
    '',
    '{(() => { window.open(url) })()}',
  ].join('\n')

  assert.deepEqual(lint(code, 'doc.mdx', mdxParser), [
    '3 template-security/link-noopener',
    '5 template-security/no-unsafe-html',
    '7 template-security/no-mixed-content',
    '7 template-security/require-sri',
    '9 template-security/no-javascript-url',
    '13 template-security/window-open-noopener',
  ])
})
