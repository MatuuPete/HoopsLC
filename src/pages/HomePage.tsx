import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

const STARTERS = [
  { position: 'PG', power: 218 },
  { position: 'SG', power: 241 },
  { position: 'SF', power: 227 },
  { position: 'PF', power: 233 },
  { position: 'C', power: 219 },
]

const SIXTH_MAN_POWER = 266
const TOTAL_POWER = STARTERS.reduce((sum, s) => sum + s.power, 0) + SIXTH_MAN_POWER

export function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <header className="flex items-center justify-between px-6 md:px-12 py-6 border-b border-chalk">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-ink" />
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">SIX MAN</span>
        </Link>
        <Link
          to="/login"
          className="bg-ink text-paper px-5 py-2 text-xs font-mono uppercase tracking-widest"
        >
          Sign In
        </Link>
      </header>

      <main className="px-6 md:px-12 py-16 md:py-24 grid md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
        <div className="flex flex-col gap-6">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-rim">
            Hoops Arena Lineup Optimizer
          </span>
          <h1 className="font-display text-5xl md:text-6xl leading-[0.95] uppercase">
            Every roster has a sixth man.
            <br />
            <span className="text-rim">Find yours.</span>
          </h1>
          <p className="text-base md:text-lg text-ink/70 max-w-md">
            Six Man scans every player you own and builds the highest-power five-man lineup your
            salary cap allows — instantly, every time your roster changes.
          </p>
          <div>
            <Link
              to="/login"
              className="inline-block bg-rim text-paper px-6 py-3 text-sm font-mono uppercase tracking-widest"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="border border-chalk bg-court/60 p-6 md:p-8 font-mono text-sm">
          <div className="flex justify-between text-xs uppercase tracking-widest text-ink/50 pb-3 border-b border-chalk">
            <span>Slot</span>
            <span>Power</span>
          </div>
          {STARTERS.map((slot) => (
            <div
              key={slot.position}
              className="flex justify-between py-2 border-b border-chalk/60"
            >
              <span className="text-ink/70">{slot.position}</span>
              <span>{slot.power}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-2 mt-1 px-2 -mx-2 bg-rim text-paper">
            <span className="uppercase tracking-widest text-xs">6th Man</span>
            <span>+{SIXTH_MAN_POWER}</span>
          </div>
          <div className="flex justify-between pt-4 mt-2 border-t border-chalk uppercase tracking-widest text-xs text-ink/50">
            <span>Total Power</span>
            <span className="text-ink text-sm normal-case tracking-normal">{TOTAL_POWER}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
