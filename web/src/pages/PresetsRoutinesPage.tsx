import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader.tsx'
import { Section } from '../components/Section.tsx'
import { PRESET_HEIGHT } from '../types.ts'

// Everyone sees this page, and each user manages their own presets and routines.
// TODO: load the user's presets and routines from the database, and make the Save buttons actually save.
// The input names are the same as the column names in the database, so the form data can be saved as it is.

export function PresetsRoutinesPage() {
  // Which form is open on the right: the new preset one or the new routine one
  const [form, setForm] = useState<'preset' | 'routine'>('routine')

  return (
    <>
      <PageHeader
        title="Presets & routines"
        description="Presets are saved to your profile, so they follow you to any desk."
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <Section
            title="My presets"
            action={<button type="button" className="btn" onClick={() => setForm('preset')}>+ New preset</button>}
          >
            {/* The user presets will be listed here, one per row, with an Edit button */}
            <p className="text-sm text-neutral-500">No presets yet.</p>
          </Section>

          <Section
            title="My routines"
            action={<button type="button" className="btn" onClick={() => setForm('routine')}>+ New routine</button>}
          >
            {/* The user routines will be listed here, one per row, with an Edit button */}
            <p className="text-sm text-neutral-500">No routines yet.</p>
          </Section>
        </div>

        {form === 'preset' ? <PresetForm /> : <RoutineForm />}
      </div>
    </>
  )
}

// For now Save doesn't save anything, it just stops the page from reloading
function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
}

function PresetForm() {
  return (
    <Section title="New preset">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-neutral-600">A preset is a desk height you can go back to with one click.</p>
        <div>
          <label htmlFor="position_name" className="label">Name</label>
          <input id="position_name" name="position_name" required className="input" placeholder="e.g. Focus stand" />
        </div>
        <div>
          <label htmlFor="value" className="label">Height (cm)</label>
          <input
            id="value"
            name="value"
            type="number"
            required
            min={PRESET_HEIGHT.min}
            max={PRESET_HEIGHT.max}
            className="input"
            placeholder={`${PRESET_HEIGHT.min}–${PRESET_HEIGHT.max}`}
          />
        </div>
        <FormButtons saveLabel="Save preset" />
      </form>
    </Section>
  )
}

function RoutineForm() {
  return (
    <Section title="New routine">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-neutral-600">A routine moves your desk between sitting and standing automatically.</p>
        <div>
          <label htmlFor="routine_name" className="label">Name</label>
          <input id="routine_name" name="routine_name" required className="input" placeholder="e.g. Morning routine" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sit_minutes" className="label">Sit for (min)</label>
            <input id="sit_minutes" name="sit_minutes" type="number" required min={1} className="input" placeholder="45" />
          </div>
          <div>
            <label htmlFor="stand_minutes" className="label">Stand for (min)</label>
            <input id="stand_minutes" name="stand_minutes" type="number" required min={1} className="input" placeholder="15" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sitting_preset_id" className="label">Sitting preset</label>
            <select id="sitting_preset_id" name="sitting_preset_id" className="input">
              <option value="">None</option>
              {/* Each of the user's presets will be an option here */}
            </select>
          </div>
          <div>
            <label htmlFor="standing_preset_id" className="label">Standing preset</label>
            <select id="standing_preset_id" name="standing_preset_id" className="input">
              <option value="">None</option>
              {/* Each of the user's presets will be an option here */}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="is_active" type="checkbox" className="size-4 accent-neutral-900" />
          Turn on right away
        </label>
        <FormButtons saveLabel="Save routine" />
      </form>
    </Section>
  )
}

function FormButtons({ saveLabel }: { saveLabel: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="reset" className="btn">Cancel</button>
      <button type="submit" className="btn-primary">{saveLabel}</button>
    </div>
  )
}
