import type { Phase, Question, Status } from '../types'

export const PHASES: Phase[] = ['recon', 'plan', 'execute', 'review', 'explain', 'done']

export function phaseColor(phase: Phase): string {
  return { recon: 'cyan', plan: 'blue', execute: 'yellow', review: 'magenta', explain: 'magenta', done: 'green' }[phase]
}

export const QUESTION_MARK = { open: '?', answered: '✓', obsolete: '~' } as const
export const QUESTION_COLOR = { open: 'yellow', answered: 'green', obsolete: 'gray' } as const

export function tally(questions: Question[]) {
  const n = { open: 0, answered: 0, obsolete: 0, told: 0 }
  for (const q of questions) {
    n[q.state] += 1
    if (q.state === 'answered' && /\(told\)\s*$/.test(q.text)) n.told += 1
  }
  return n
}

// Open questions first: they're the ones to act on.
export function ordered(questions: Question[]): Question[] {
  const rank = { open: 0, answered: 1, obsolete: 2 }
  return [...questions].sort((a, b) => rank[a.state] - rank[b.state])
}

// The phase, plus the step while executing: what the user is doing right now.
export function where(s: Status): string {
  return s.phase === 'execute' ? `execute · step ${s.step}` : s.phase
}

// Short facts after the counts: progress the phase is measured by.
export function progress(s: Status): string {
  if (s.phase === 'execute') return s.hint > 0 ? `hint ${s.hint}/3` : s.fails > 0 ? `${s.fails} failed` : ''
  if (s.phase === 'explain' || s.phase === 'done') return `why ${s.chunks.done}/${s.chunks.total}`
  if (s.phase === 'review' && s.review.result) return `review: ${s.review.result}`
  return ''
}

export function summary(s: Status): string {
  const n = tally(s.questions)
  return [`own-it ${where(s)}`, `?${n.open} ✓${n.answered} ~${n.obsolete}`, progress(s)].filter(Boolean).join(' · ')
}

export function planLines(s: Status): string[] {
  const lines = [`Task: ${s.task}`]
  if (s.phase === 'execute') {
    lines.push(`Step ${s.step}: ${s.stepTitle}`, `Files: ${s.files.join(', ')}`)
    lines.push(s.prediction ? `Prediction: ${s.prediction}` : 'Prediction: none yet. Predict before the next run.')
  }
  if (s.skips > 0) lines.push(`Gates skipped: ${s.skips}`)
  return lines
}

export function parseStatus(stdout: string): Status | null {
  try {
    const s = JSON.parse(stdout)
    return s?.active === true && PHASES.includes(s.phase) ? (s as Status) : null
  } catch {
    return null
  }
}
