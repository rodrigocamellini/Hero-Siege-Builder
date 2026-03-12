import { UsersTable } from '../../../../features/admin/UsersTable';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <main className="space-y-6">
      <UsersTable />
    </main>
  );
}
