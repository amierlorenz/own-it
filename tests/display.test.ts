import { expect, test } from 'claude-code/testing'

import type { Status } from '../types'
import { ordered, parseStatus, progress, summary, tally } from '../hooks/display'

const base: Status = {
  active: true,
  folder: 'app',
  gate: '',
  task: 't',
  phase: 'recon',
  step: 0,
  stepTitle: '',
  files: [],
  prediction: null,
  fails: 0,
  hint: 0,
  lastExit: null,
  questions: [],
  chunks: { done: 0, total: 0 },
  review: { result: '', scores: [] },
  skips: 0,
  rubric: '/r.md',
}

test('tally counts told answers apart', async () => {
  const n = tally([
    { state: 'answered', text: 'a → x (told)' },
    { state: 'answered', text: 'b → y (read)' },
    { state: 'open', text: 'c' },
  ])
  expect(n).toEqual({ open: 1, answered: 2, obsolete: 0, told: 1 })
})

test('open questions come first', async () => {
  const qs = ordered([
    { state: 'obsolete', text: 'o' },
    { state: 'answered', text: 'a' },
    { state: 'open', text: 'q' },
  ])
  expect(qs.map(q => q.state)).toEqual(['open', 'answered', 'obsolete'])
})

test('progress follows the phase', async () => {
  expect(progress({ ...base, phase: 'execute', fails: 2 })).toBe('2 failed')
  expect(progress({ ...base, phase: 'execute', fails: 4, hint: 2 })).toBe('hint 2/3')
  expect(progress({ ...base, phase: 'explain', chunks: { done: 3, total: 5 } })).toBe('why 3/5')
  expect(progress(base)).toBe('')
  expect(summary(base)).toBe('own-it recon · ?0 ✓0 ~0')
})

test('parseStatus refuses anything but an active task', async () => {
  expect(parseStatus('')).toBeNull()
  expect(parseStatus('{"active":true,"phase":"off"}')).toBeNull()
  expect(parseStatus(JSON.stringify(base))?.phase).toBe('recon')
})
