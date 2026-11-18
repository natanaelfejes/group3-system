import { PageHeader } from '../../components/PageHeader.tsx'

// Only the admin can open this page
export function UsersPage() {
  return (
    <>
      <PageHeader title="Users" description="Manage user accounts and their roles." />
    </>
  )
}
