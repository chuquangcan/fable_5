import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { useDemo } from '../store/demo'
import { CiteChip } from './AgentPanel'

beforeEach(() => useDemo.getState().reset())

test('unknown cite is not clickable', () => { // Review Focus #3
  render(<CiteChip label="IQC-9999" target_id={null} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('IQC-9999')).toBeInTheDocument()
})

test('known cite focuses its node and opens the matching evidence tab', async () => {
  render(<CiteChip label="IQC-5531" target_id="IQC-5531" />)
  await userEvent.click(screen.getByRole('button', { name: 'IQC-5531' }))
  expect(useDemo.getState().focusNodeId).toBe('IQC-5531')
  expect(useDemo.getState().evidenceTab).toBe('lot')
})

test('cite without an evidence tab keeps the current one', async () => {
  useDemo.getState().setEvidence('impact')
  render(<CiteChip label="D-12 p.7" target_id="D-12" />)
  await userEvent.click(screen.getByRole('button'))
  expect(useDemo.getState().focusNodeId).toBe('D-12')
  expect(useDemo.getState().evidenceTab).toBe('impact')
})
