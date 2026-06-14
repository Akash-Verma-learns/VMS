import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import type { AdvanceCalc } from '../../lib/domain'
import { money, num } from '../../lib/format'
import { PageHeader, AsyncBoundary, Stat } from '../../components/ui'

export function AdvanceCalcPage() {
  const { data, loading, error } = useApi(() => api.get<AdvanceCalc[]>('/finance/advances'))
  const calcs = data ?? []
  const grandTotal = calcs.reduce((s, c) => s + c.total, 0)

  return (
    <div className="page">
      <PageHeader title="Advance Calculation" subtitle="Computed advances per centre with line-item breakdown" />
      <AsyncBoundary loading={loading} error={error} empty={calcs.length === 0}>
        <div className="stat-row">
          <Stat label="Calculations" value={calcs.length} />
          <Stat label="Candidates covered" value={num(calcs.reduce((s, c) => s + c.candidates, 0))} />
          <Stat label="Total advance" value={money(grandTotal)} tone="info" />
        </div>

        <div className="stack gap-lg">
          {calcs.map((c) => (
            <div key={c.id} className="card">
              <div className="card-header">
                <div><strong>{c.centre}</strong><div className="faint">{c.examName} · {num(c.candidates)} candidates</div></div>
                <span className="pill">{money(c.total)}</span>
              </div>
              <div className="card-pad">
                <table className="table">
                  <thead><tr><th>Head</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {c.lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.label}</td>
                        <td style={{ textAlign: 'right' }}>{num(l.qty)}</td>
                        <td style={{ textAlign: 'right' }}>{money(l.rate)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(l.qty * l.rate)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy-700)' }}>{money(c.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </div>
  )
}
