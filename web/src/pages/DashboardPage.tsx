import { PageHeader } from '../components/PageHeader.tsx'
import { Section } from '../components/Section.tsx'
import type { Preset, Routine } from '../types.ts'

// Everyone sees this page
// There are no buttons for making presets or routines here, that's done on the Presets & routines page, no need for it here

// We show this dash wherever there's no data yet
const EMPTY = '—'

// Finds the preset that "Stand now" should move the desk to.
// It looks for the routine the user has turned on, and takes the standing preset from that routine.
// If no routine is turned on, or it has no standing preset, we get nothing back and the button does nothing.
function standingPreset(presets: Preset[], routines: Routine[]): Preset | undefined {
  const activeRoutine = routines.find((routine) => routine.is_active && routine.standing_preset_id)
  return presets.find((preset) => preset.preset_id === activeRoutine?.standing_preset_id)
}

// Moves the desk to a height (in cm).
// have to send it to the backend
function moveDesk(_heightCm: number) {}

export function DashboardPage() {
  // TODO: load this user's desk, presets, routines and health from the database (the page gets `user` for that).
  // For now these lists are empty, so nothing shows up and the buttons have nothing to do.
  const presets: Preset[] = []
  const routines: Routine[] = []

  function standNow() {
    const preset = standingPreset(presets, routines)
    if (preset) moveDesk(preset.value)
  }

  return (
    <>
      <div className="hidden md:block">
        <PageHeader title="My desk" description="Here is your desk and today's activity.">
          {/* Will show the desk name and whether it's connected */}
          <span className="badge">{EMPTY}</span>
        </PageHeader>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="order-3 grid grid-cols-2 gap-4 md:order-none md:col-span-2 md:grid-cols-4">
          <StatTile label="Assigned desk" className="hidden md:block" />
          <StatTile label="Sitting today" />
          <StatTile label="Standing today" />
          <StatTile label="Next routine" className="hidden md:block" />
        </div>

        <Section title="Desk control" className="order-1 md:order-none">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between">
            <div className="text-center md:text-left">
              <p className="text-xs text-neutral-600">Current height</p>
              <p className="my-1 text-5xl font-bold">{EMPTY}</p>
              <p className="hidden text-sm text-neutral-600 md:block">Range {EMPTY}</p>
            </div>
            {/* On a phone Down is on the left and Up on the right, on a computer Up is above Down */}
            <div className="flex flex-row-reverse gap-2 md:w-32 md:flex-col">
              <button type="button" className="btn flex-1 md:flex-none">▲ Up</button>
              <button type="button" className="btn flex-1 md:flex-none">▼ Down</button>
            </div>
          </div>
          <p className="mt-4 text-xs text-neutral-600">Hold to move, release to stop</p>

          <h3 className="mt-4 mb-2 text-sm font-medium">My presets</h3>
          {presets.length === 0 ? (
            <p className="text-sm text-neutral-500">No presets yet. Add them on the Presets & routines page.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button key={preset.preset_id} type="button" className="btn" onClick={() => moveDesk(preset.value)}>
                  {preset.position_name} · {preset.value} cm
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section title="My health" className="order-2 md:order-none">
          <div className="hidden md:block">
            {/* The chart of sitting vs standing this week goes here */}
            <div className="h-40" />
            <div className="mt-2 mb-4 flex gap-4 text-xs text-neutral-600">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 bg-neutral-800" /> Standing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 bg-neutral-200" /> Sitting
              </span>
            </div>
          </div>
          {/* Later this box should only show up when the user has been sitting for too long */}
          <div className="flex flex-col gap-3 rounded-lg bg-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Time to stand?</p>
              <p className="text-sm text-neutral-600">You have been sitting for {EMPTY}.</p>
            </div>
            <button type="button" className="btn-primary" onClick={standNow}>
              Stand now
            </button>
          </div>
        </Section>

        <Section title="My routines" className="hidden md:col-span-2 md:block">
          {/* The user's routines will be listed here, one per row */}
          <p className="text-sm text-neutral-500">No routines yet.</p>
        </Section>
      </div>
    </>
  )
}

function StatTile({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return (
    <div className={`card p-4 ${className}`}>
      <p className="text-xs text-neutral-600">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? EMPTY}</p>
    </div>
  )
}
