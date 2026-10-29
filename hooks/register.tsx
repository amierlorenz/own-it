import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Panel, Status } from '../types'
import { QUESTION_COLOR, QUESTION_MARK, ordered, parseStatus, phaseColor, planLines, progress, summary, tally, where } from './display'

// Shows the repo's own-it task as a band above the prompt (style `band`) or at the end of the hint line
// (style `hint`). Early-access API: every hook passes the event on if it fails, so the guard (a plain command
// hook) never depends on it.

// Change a shape tag when that value's fields change: a reload keeps what an older version saved.
const status = atom({ plugin: 'own-it', key: 'status' } as const, null, { shape: 'status-1' })
const panel = atom({ plugin: 'own-it', key: 'panel' } as const, null)

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const ran = await $.process.run([`${$.plugin.root}/bin/own-it`, '-C', cwd, 'status', '--json'])
  const next = ran.exitCode === 0 ? parseStatus(ran.stdout) : null
  await update($, status, () => next)
}

function toggle($: EngineInterface, which: Exclude<Panel, null>) {
  return update($, panel, open => (open === which ? null : which))
}

export const register: Register = (on, options) => {
  const isHint = options.style === 'hint'

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await update($, panel, () => null)
    await refresh($)
    return result
  })

  // A prompt covers what the user changed in their editor (questions, plan) since the last turn.
  on('prompt.submit', async ($, e, next) => {
    await refresh($)
    return next(e)
  }).catch(($, e, next) => next(e))

  // own-it commands and edits to .own-it/ change what the band shows. The cwd moves only after this hook
  // returns, so refresh from a timer.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    $.clock.after(0, () => void refresh($))
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const now = await read($, status)
    if (!isHint || !now) return next(e)
    const { Text } = $.ui.resolve(e)
    return (
      <Text wrap="truncate-end">
        <Text dimColor>{e.props.hint} · </Text>
        <Text color={phaseColor(now.phase)}>{summary(now)}</Text>
      </Text>
    )
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, status)
    if (isHint || !now || e.props.hasSurvey) return next(e)
    // Other plugins share the band: draw theirs below ours instead of replacing it.
    const below = await next(e).catch(() => undefined)
    const { Box, Button, Text } = $.ui.resolve(e)
    const open = await read($, panel)
    const n = tally(now.questions)
    const more = progress(now)
    const label = (which: Exclude<Panel, null>) => (open === which ? `hide ${which}` : which)

    const mine = (
      <Box flexDirection="column">
        <Box justifyContent="space-between" width={e.props.bodyColumns}>
          <Text wrap="truncate-end">
            <Text bold>own-it </Text>
            <Text bold color={phaseColor(now.phase)}>{where(now)}</Text>
            <Text dimColor> · {now.folder}   </Text>
            <Text color="yellow">?{n.open}</Text>
            <Text> </Text>
            <Text color="green">✓{n.answered}</Text>
            <Text> </Text>
            <Text dimColor>~{n.obsolete}</Text>
            {more && <Text dimColor>   {more}</Text>}
          </Text>
          <Box>
            <Button key="questions" plain label={label('questions')} onPress={() => toggle($, 'questions')} />
            <Text>   </Text>
            <Button key="plan" plain label={label('plan')} onPress={() => toggle($, 'plan')} />
            <Text>   </Text>
            <Button key="review" plain label={label('review')} onPress={() => toggle($, 'review')} />
          </Box>
        </Box>
        {now.gate && <Text dimColor wrap="truncate-end">  next: {now.gate}</Text>}
        {open === 'questions' && (
          <Box flexDirection="column">
            {now.questions.length === 0 && (
              <Text dimColor>  No questions yet. Write one in .own-it/questions.md the moment something is unclear.</Text>
            )}
            {ordered(now.questions)
              .slice(0, 8)
              .map(q => (
                <Text wrap="truncate-end" color={QUESTION_COLOR[q.state]} dimColor={q.state === 'obsolete'}>
                  {'  '}
                  {QUESTION_MARK[q.state]} {q.text}
                </Text>
              ))}
            {n.told > 0 && <Text dimColor>  {n.told} of {n.answered} answers were told, not found.</Text>}
          </Box>
        )}
        {open === 'plan' && (
          <Box flexDirection="column">
            {planLines(now).map(line => (
              <Text wrap="truncate-end" dimColor>  {line}</Text>
            ))}
          </Box>
        )}
        {open === 'review' && (
          <Box flexDirection="column">
            {now.review.scores.length === 0 && <Text dimColor>  No review yet.</Text>}
            {now.review.scores.map(r => (
              <Text wrap="truncate-end">
                <Text color={r.score === 'N/A' ? 'gray' : Number(r.score) >= 3 ? 'green' : 'red'}>  {r.score.padEnd(4)}</Text>
                <Text>{r.name}</Text>
              </Text>
            ))}
            {now.review.result && <Text dimColor>  Result: {now.review.result}</Text>}
          </Box>
        )}
      </Box>
    )
    return below ? (
      <Box flexDirection="column">
        {mine}
        {below}
      </Box>
    ) : (
      mine
    )
  }).catch(($, e, next) => next(e))
}
