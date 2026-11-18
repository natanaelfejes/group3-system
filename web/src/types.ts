// The tables from our database, written as TypeScript types.
// The field names are exactly the same as the column names, so data from the backend fits without renaming anything.
// uuid and timestamptz (dates) come in as plain strings, and a column that can be NULL gets "| null".

export type Role = 'admin' | 'worker' | 'maintenance_worker'

// The users table. user_id is the same id that Supabase Auth gives the user when they sign up.
export type User = {
  user_id: string
  name: string
  email: string
  role: Role
  created_at: string
}

// The desks table.
export type Desk = {
  desk_id: string
  user_id: string | null
  manufacturer: string
  // in cm
  last_height: number | null
}

// The presets table.
export type Preset = {
  preset_id: string
  user_id: string
  position_name: string
  // The height in cm. Has to be between 50 and 160 (see PRESET_HEIGHT below).
  value: number
}

// The lowest and highest height a preset can have. The database checks the same thing.
export const PRESET_HEIGHT = { min: 50, max: 160 }

// The routines table.
export type Routine = {
  routine_id: string
  user_id: string
  routine_name: string
  sit_minutes: number
  stand_minutes: number
  sitting_preset_id: string | null
  standing_preset_id: string | null
  is_active: boolean
  created_at: string
}

// The health table.
export type HealthRecord = {
  health_id: string
  user_id: string
  position: 'sitting' | 'standing'
  recorded_at: string
}

// The errors table.
export type DeskError = {
  error_id: string
  desk_id: string
  description: string
  created_at: string
}
