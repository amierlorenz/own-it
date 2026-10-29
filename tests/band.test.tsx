import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { Status } from '../types'

type On = Parameters<TestBody>[1]

const BAND = {
  plugin: 'own-it',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const HINT = {
  plugin: 'own-it',
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

const EXECUTE: Status = {
  active: true,
  folder: 'app',
  gate: 'The last run must pass first.',
  task: 'fix #42',
  phase: 'execute',
  step: 2,
  stepTitle: 'return early on empty title',
  files: ['src/create.py'],
  prediction: 'a 400 response',
  fails: 3,
  hint: 1,
  lastExit: 1,
  questions: [
    { state: 'answered', text: 'what calls create()? → the route (read)' },
    { state: 'open', text: 'why validate after saving?' },
    { state: 'obsolete', text: 'ORM caching? → crash is before any query' },
    { state: 'answered', text: 'drafts allowed? → yes (told)' },
  ],
  chunks: { done: 0, total: 0 },
  review: { result: '', scores: [] },
  skips: 0,
  rubric: '/r.md',
}

// Nothing sits beneath the plugin: these hooks stand for the engine and the own-it command.
function engine(on: On, status: Status | null = EXECUTE) {
  on('session.cwd', () => ({ value: '/work/app' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('process.run', () => ({
    value: {
      exitCode: status ? 0 : 1,
      stdout: status ? JSON.stringify(status) : '',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
}

test('the band shows phase, step, question counts and hint level, on terminal and desktop', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: 'execute · step 2' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '?1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '✓2' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /hint 1\/3/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /next: The last run must pass first/ })).toBeDefined()

    await ui.press({ key: 'questions' })
    expect(await ui.find({ type: 'Text', text: /\? why validate after saving/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1 of 2 answers were told/ })).toBeDefined()

    await ui.press({ key: 'plan' })
    expect(await ui.find({ type: 'Text', text: /Prediction: a 400 response/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /why validate after saving/ })).toBeUndefined()
    await ui.press({ key: 'plan' })
    await ui.unmount()
  }
})

test('the review panel lists scores and the result', async ($, on) => {
  engine(on, {
    ...EXECUTE,
    phase: 'review',
    review: { result: 'loop', scores: [{ name: 'Security', score: '2' }, { name: 'Performance', score: 'N/A' }] },
  })
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /review: loop/ })).toBeDefined()
  await ui.press({ key: 'review' })
  expect(await ui.find({ type: 'Text', text: 'Security' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Result: loop/ })).toBeDefined()
  await ui.unmount()
})

test('no task in progress: the band is left to the engine', async ($, on) => {
  engine(on, null)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})

test("another plugin's band is drawn below, not replaced", async ($, on) => {
  engine(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>other band</Text>
  })
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'other band' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'execute · step 2' })).toBeDefined()
  await ui.unmount()
})

test('style hint puts the summary on the hint line and leaves the band alone', { options: { style: 'hint' } }, async ($, on) => {
  engine(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  const hint = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect(await hint.find({ type: 'Text', text: /own-it execute · step 2 · \?1 ✓2 ~1 · hint 1\/3/ })).toBeDefined()
  await hint.unmount()

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ type: 'Text' }))?.text).toBe('engine')
  await band.unmount()
})

test('a status saved by an older version is declined, then refreshed', async ($, on) => {
  engine(on, null)
  on('state.get', (_, e, next) =>
    e.key === 'status' ? { value: { value: { phase: 'execute', questions: 3 }, version: 1 } } : next(e),
  )
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})
