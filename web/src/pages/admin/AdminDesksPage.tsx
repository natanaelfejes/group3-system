import { PageHeader } from '../../components/PageHeader.tsx'

// This is the Desks page the admin sees. Maintenance gets a different one: pages/maintenance/MaintenanceDesksPage.tsx
export function AdminDesksPage() {
  return (
    <>
      <PageHeader title="Desks" description="Manage all desks and who they are assigned to." />
    </>
  )
}
