import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { AttachResult, NodeSummary } from '../api/types'
import attachCoa from '../test/fixtures/attach_coa.json'
import { useDemo } from '../store/demo'
import { AttachDialog } from './AttachDialog'

vi.mock('../api/client')

const SAMPLES = ['CoA_S1-6203-B.pdf', 'BienBan_BaoTri_Press2_2026-11-05.pdf', 'Email_CustomerC5_xac_nhan_nhan_hang.txt']

beforeEach(() => {
  useDemo.getState().reset()
  useDemo.getState().openAttach()
  vi.mocked(api.listSamples).mockResolvedValue(SAMPLES)
  vi.mocked(api.attachSample).mockResolvedValue(attachCoa as AttachResult)
  const TYPES: Record<string, string> = { 'LOT-B': 'lot', 'MH20-0001': 'serial', 'AGG-LOT-B': 'aggregate', 'D-07': 'document', 'PM-0241': 'event' }
  vi.mocked(api.getSummary).mockImplementation(async (id) => ({ id, type: TYPES[id] ?? 'machine' }) as NodeSummary)
})

afterEach(() => vi.useRealTimers())

test('renders nothing while closed', () => {
  useDemo.getState().closeAttach()
  render(<AttachDialog />)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('sample button attaches: result card, dataVersion +1, flash on target', async () => {
  render(<AttachDialog />)
  expect(screen.getByRole('dialog', { name: 'Gắn tài liệu' })).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'CoA_S1-6203-B.pdf' }))
  expect(await screen.findByText('Mã')).toBeInTheDocument()
  expect(screen.getByText('LOT-B')).toBeInTheDocument()
  expect(screen.getByText('inferred · 0.9')).toBeInTheDocument()
  expect(screen.getByText(/alias NCC/)).toBeInTheDocument()
  expect(screen.queryByText('Tài liệu đã gắn trước đó')).toBeNull()
  expect(api.attachSample).toHaveBeenCalledWith('CoA_S1-6203-B.pdf')
  expect(useDemo.getState().dataVersion).toBe(1)
  expect(useDemo.getState().flashNodeId).toBe('LOT-B')
})

test('upload sends the file with the focused node as hint', async () => {
  useDemo.setState({ focusNodeId: 'LOT-B' })
  vi.mocked(api.uploadDocument).mockResolvedValue(attachCoa as AttachResult)
  render(<AttachDialog />)
  const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
  expect(await screen.findByText('Đích gợi ý khi không nhận ra mã: LOT-B')).toBeInTheDocument()
  await userEvent.upload(screen.getByLabelText('Chọn tệp'), file)
  expect(await screen.findByText('inferred · 0.9')).toBeInTheDocument()
  expect(api.uploadDocument).toHaveBeenCalledWith(file, 'LOT-B')
})

test('without a focused node the hint defaults to the thread root, like the overview', async () => {
  useDemo.setState({ threadRoot: 'MH20-0001' })
  vi.mocked(api.uploadDocument).mockResolvedValue(attachCoa as AttachResult)
  render(<AttachDialog />)
  expect(await screen.findByText('Đích gợi ý khi không nhận ra mã: MH20-0001')).toBeInTheDocument()
  const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
  await userEvent.upload(screen.getByLabelText('Chọn tệp'), file)
  expect(api.uploadDocument).toHaveBeenCalledWith(file, 'MH20-0001')
})

test.each(['AGG-LOT-B', 'D-07', 'PM-0241'])('non-object target %s is not sent as a hint', async (id) => {
  useDemo.setState({ focusNodeId: id, threadRoot: 'MH20-0001' })
  vi.mocked(api.uploadDocument).mockResolvedValue(attachCoa as AttachResult)
  render(<AttachDialog />)
  expect(await screen.findByText(`${id} không phải đối tượng — tài liệu không có mã sẽ bị từ chối`)).toBeInTheDocument()
  expect(screen.queryByText(/Đích gợi ý/)).toBeNull()
  const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
  await userEvent.upload(screen.getByLabelText('Chọn tệp'), file)
  expect(api.uploadDocument).toHaveBeenCalledWith(file, undefined)
})

test('a drop while an attach is running is ignored', async () => {
  vi.mocked(api.uploadDocument).mockReturnValue(new Promise(() => {}))
  render(<AttachDialog />)
  const zone = screen.getByText('Kéo thả tệp vào đây hoặc chọn tệp').parentElement!
  const drop = () => fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'a.pdf')] } })
  drop()
  expect(await screen.findByText('Đang gắn…')).toBeInTheDocument()
  drop()
  expect(api.uploadDocument).toHaveBeenCalledTimes(1)
})

test('upload error shows the detail and leaves dataVersion alone', async () => {
  vi.mocked(api.uploadDocument).mockRejectedValue(new Error('415 Định dạng không hỗ trợ'))
  render(<AttachDialog />)
  await userEvent.upload(screen.getByLabelText('Chọn tệp'), new File(['x'], 'a.exe'), { applyAccept: false })
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('415 Định dạng không hỗ trợ')
  expect(useDemo.getState().dataVersion).toBe(0)
  expect(useDemo.getState().flashNodeId).toBeNull()
})

test('duplicate result shows the already-attached line', async () => {
  vi.mocked(api.attachSample).mockResolvedValue({ ...(attachCoa as AttachResult), duplicate: true })
  render(<AttachDialog />)
  await userEvent.click(await screen.findByRole('button', { name: 'CoA_S1-6203-B.pdf' }))
  expect(await screen.findByText('Tài liệu đã gắn trước đó')).toBeInTheDocument()
})

test('result without links still renders and does not flash', async () => {
  vi.mocked(api.attachSample).mockResolvedValue({ ...(attachCoa as AttachResult), links: [], method: 'llm' })
  render(<AttachDialog />)
  await userEvent.click(await screen.findByRole('button', { name: 'CoA_S1-6203-B.pdf' }))
  expect(await screen.findByText('LLM')).toBeInTheDocument()
  expect(useDemo.getState().flashNodeId).toBeNull()
})

test('close button and Escape close the dialog', async () => {
  const { unmount } = render(<AttachDialog />)
  await userEvent.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(useDemo.getState().attachOpen).toBe(false)
  unmount()
  useDemo.getState().openAttach()
  render(<AttachDialog />)
  await userEvent.keyboard('{Escape}')
  expect(useDemo.getState().attachOpen).toBe(false)
})

test('flash clears after 1200 ms and a newer flash is not cleared early', () => {
  vi.useFakeTimers()
  const { flash } = useDemo.getState()
  flash('A')
  vi.advanceTimersByTime(1000)
  flash('B')
  vi.advanceTimersByTime(500)
  expect(useDemo.getState().flashNodeId).toBe('B')
  vi.advanceTimersByTime(700)
  expect(useDemo.getState().flashNodeId).toBeNull()
})
