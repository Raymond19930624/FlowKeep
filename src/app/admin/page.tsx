import ProjectAdminPage from '@/components/ProjectAdminPage';

// This page should ideally be protected, e.g., by checking a session or token.
// For this exercise, we assume access is granted if navigated to.

export default function AdminPage() {
  return (
    <main>
      <ProjectAdminPage />
    </main>
  );
}
