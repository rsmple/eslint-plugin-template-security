import {RuleTester} from 'eslint'
import * as astroParser from 'astro-eslint-parser'
import * as svelteParser from 'svelte-eslint-parser'
import * as vueParser from 'vue-eslint-parser'
import {describe, it} from 'node:test'

globalThis.describe = describe
globalThis.it = it

export const jsx = new RuleTester({
  languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}},
})

export const vue = new RuleTester({
  languageOptions: {parser: vueParser},
})

export const astro = new RuleTester({
  languageOptions: {parser: astroParser},
})

export const svelte = new RuleTester({
  languageOptions: {parser: svelteParser},
})

export const vueFile = (template, script = '') => `<template>${ template }</template>\n<script>${ script }</script>\n`
