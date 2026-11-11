import { render, screen } from '@testing-library/react'
import { AppShell } from './AppShell'

test('header shows fixed demo clock and badge', () => {
  render(<AppShell left={null} main={null} right={null} />)
  expect(screen.getByText('2027-02-12 09:00')).toBeInTheDocument()
  expect(screen.getByText('DEMO · DỮ LIỆU MẪU')).toBeInTheDocument()
})
