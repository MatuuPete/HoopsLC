import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Eyebrow, TierBadge } from '../components/LineupParts'
import { buttonSecondary } from '../components/ui'

interface Step {
  title: string
  where: { label: string; to: string }
  body: ReactNode
}

const STEPS: Step[] = [
  {
    title: 'Add the players you own',
    where: { label: 'Open Players', to: '/players' },
    body: (
      <>
        <p>
          Your roster is the pool the lineup builder picks from, so start by adding every player you
          own.
        </p>
        <ol>
          <li>
            On the Players page, click <Ui>Add from catalog</Ui>, search for the player and pick them.
          </li>
          <li>
            Enter the <Ui>Base salary</Ui>: the price you own that player at. This is the number that
            counts against your salary cap.
          </li>
          <li>
            Check the <Ui>Positions</Ui>. They come from the catalog, but you can switch on any extra
            positions the player can cover.
          </li>
          <li>
            Click <Ui>Add to roster</Ui>.
          </li>
        </ol>
        <p>
          You don't need to type in catalog price, offense or defense. They come from the catalog and
          update on their own whenever the catalog is refreshed. The only number you keep up to date is
          base salary.
        </p>
      </>
    ),
  },
  {
    title: 'Add your X Players',
    where: { label: 'Open Players', to: '/players' },
    body: (
      <>
        <p>
          X Players aren't in the catalog, so you enter them by hand with <Ui>Add X Player</Ui>.
        </p>
        <ol>
          <li>
            Choose the type: <TierBadge tier="standard" /> <Ui>X Player</Ui>, where offense and defense
            add up to exactly 450, or <TierBadge tier="legend" /> <Ui>Legend X</Ui>, where they add up to
            exactly 500.
          </li>
          <li>Enter the name, positions, offense and defense. The form shows when the total is right.</li>
          <li>
            Click <Ui>Add X Player</Ui>. X Players always cost 999 salary.
          </li>
        </ol>
        <p>
          To fix a mistake later, use the pencil icon on the player's row, or click the row and choose{' '}
          <Ui>Edit player</Ui>.
        </p>
      </>
    ),
  },
  {
    title: 'Set up the lineup builder',
    where: { label: 'Open Lineup Builder', to: '/lineup' },
    body: (
      <>
        <p>Everything here saves automatically, so it's still set the next time you come back.</p>
        <ul>
          <li>
            <Ui>Salary cap</Ui>: the most base salary your five players can add up to.
          </li>
          <li>
            <Ui>Optimize for</Ui>: <Ui>Max power</Ui> picks the five with the highest combined salary
            power. <Ui>Stats</Ui> picks the best offense and defense instead. Drag the slider toward the
            side you care about more.
          </li>
          <li>
            <Ui>Preferred players</Ui>: tick anyone you want in the lineup. They're kept in whenever
            they fit under the cap.
          </li>
          <li>
            <Ui>Unavailable players</Ui>: tick anyone you can't use right now, such as a player a
            friend has borrowed. They're left out of the calculation.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Calculate your best lineup',
    where: { label: 'Open Lineup Builder', to: '/lineup' },
    body: (
      <>
        <p>
          Click <Ui>Calculate best lineup</Ui>. The result card shows your five players from PG to C,
          with:
        </p>
        <ul>
          <li>
            A <Ui>Salary used</Ui> bar showing how your cap is split across the five positions. The
            orange piece is your X Player.
          </li>
          <li>Each player's base salary, offense and defense.</li>
          <li>Total offense, total defense and the two TPower totals.</li>
        </ul>
        <p>
          If no lineup works, the card tells you why and what to change. For example, when the cap is
          too low it shows the closest lineup and how far over the cap it is.
        </p>
      </>
    ),
  },
  {
    title: 'Save lineups and build the next one',
    where: { label: 'Open Lineup Builder', to: '/lineup' },
    body: (
      <>
        <p>
          Click <Ui>Save lineup</Ui> to keep it. It appears under <Ui>Saved lineups</Ui>, and its
          players are left out of your next calculation. That way you can build several lineups in a
          row without using the same player twice.
        </p>
        <ul>
          <li>Click a saved lineup's name to rename it.</li>
          <li>Delete a saved lineup with the trash icon to make its players available again.</li>
          <li>
            A saved lineup keeps the prices and stats from the moment you saved it, even if the catalog
            changes later.
          </li>
        </ul>
      </>
    ),
  },
]

const RULES = [
  'Every lineup has five players, one each at PG, SG, SF, PF and C.',
  'Every lineup has exactly one X Player. Either type counts.',
  'The five base salaries must add up to no more than your salary cap.',
  'A player who can play several positions can fill any one of them, but only one slot per lineup.',
]

const TERMS: { term: string; meaning: string }[] = [
  { term: 'Base salary', meaning: 'The price you own a player at. You enter it, and it counts against your cap.' },
  { term: 'Current salary', meaning: "The player's catalog price today. It updates on its own when the catalog is refreshed." },
  { term: 'TPower · salary', meaning: 'The five current salaries added together. This is what Max power makes as high as possible.' },
  { term: 'TPower · stats', meaning: 'Offense plus defense for all five players.' },
  { term: 'Without kits', meaning: 'Totals in the app never include kit boosts.' },
  { term: 'Value', meaning: 'Offense plus defense divided by current salary. Higher means more stats for the money.' },
]

/** Names of on-screen controls, set apart so readers can spot them in the app. */
function Ui({ children }: { children: ReactNode }) {
  return <span className="font-medium text-text">{children}</span>
}

export function GuidePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 font-body sm:px-6 lg:py-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-text sm:text-5xl">
          How it works
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Six Man picks the strongest five you can field from the players you own, under your salary
          cap. Add your roster once, then build as many lineups as you need.
        </p>
      </header>

      <ol className="mt-8 flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-xl border border-border bg-panel">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 p-5 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:p-6">
              <span
                aria-hidden
                className="font-display text-4xl leading-none text-muted/50 sm:text-5xl"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-3">
                <h2 className="text-lg font-medium text-text">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h2>
                <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted [&_li]:pl-1 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_ol]:marker:font-mono [&_ol]:marker:text-xs [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:marker:text-border">
                  {step.body}
                </div>
                <Link to={step.where.to} className={`${buttonSecondary} mt-1 w-fit px-3 py-1.5`}>
                  {step.where.label}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 rounded-xl border border-border bg-panel p-5 sm:p-6">
        <Eyebrow>Lineup rules</Eyebrow>
        <ul className="mt-4 flex flex-col gap-3">
          {RULES.map((rule) => (
            <li key={rule} className="flex gap-3 text-sm leading-relaxed text-text/90">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-panel p-5 sm:p-6">
        <Eyebrow>Terms you'll see</Eyebrow>
        <dl className="mt-4 divide-y divide-border">
          {TERMS.map(({ term, meaning }) => (
            <div key={term} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-medium text-text">{term}</dt>
              <dd className="text-sm leading-relaxed text-muted">{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
