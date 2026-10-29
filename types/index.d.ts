export type Phase = 'recon' | 'plan' | 'execute' | 'review' | 'explain' | 'done'
export type Question = { state: 'open' | 'answered' | 'obsolete'; text: string }
export type Score = { name: string; score: string }

// What `own-it status --json` prints.
export type Status = {
  active: true
  folder: string
  gate: string
  task: string
  phase: Phase
  step: number
  stepTitle: string
  files: string[]
  prediction: string | null
  fails: number
  hint: number
  lastExit: number | null
  questions: Question[]
  chunks: { done: number; total: number }
  review: { result: string; scores: Score[] }
  skips: number
  rubric: string
}

export type Panel = 'questions' | 'plan' | 'review' | null

declare module 'claude-code' {
  interface PluginState {
    'own-it': {
      status: Shaped<Status | null>
      panel: Panel
    }
  }
}
