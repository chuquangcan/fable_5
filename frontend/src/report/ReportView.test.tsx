import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { ReportDraft } from '../api/types'
import draft from '../test/fixtures/report_draft.json'
import { useDemo } from '../store/demo'
import { ReportView } from './ReportView'

vi.mock('../api/client')

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getReportDraft).mockResolvedValue(draft as unknown as ReportDraft)
})

test('renders the draft with impact numbers and cite chips', async () => {
  const { container } = render(<ReportView claimId="CLM-0012" />)
  expect(await screen.findByText('RPT-CLM-0012')).toBeInTheDocument()
  expect(api.getReportDraft).toHaveBeenCalledWith('CLM-0012')
  expect(screen.getByText('640')).toBeInTheDocument()
  expect(screen.getByText('1,000')).toBeInTheDocument()
  expect(container.querySelectorAll('.cite').length).toBeGreaterThanOrEqual(3)
  expect(screen.getByText(/Quarantine 360 parts of SHP-1120/)).toBeInTheDocument()
})

test('Export and Send only show a toast', async () => {
  render(<ReportView claimId="CLM-0012" />)
  await screen.findByText('RPT-CLM-0012')
  await userEvent.click(screen.getByRole('button', { name: 'Send to Quality' }))
  expect(screen.getByRole('status')).toHaveTextContent('Demo: sending not available')
  await userEvent.click(screen.getByRole('button', { name: 'Export PDF' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Demo'))
})

test('a failing request shows an error instead of crashing', async () => {
  vi.mocked(api.getReportDraft).mockRejectedValue(new Error('404 report CLM-0012 not found'))
  render(<ReportView claimId="CLM-0012" />)
  expect(await screen.findByText(/not found/)).toBeInTheDocument()
})
