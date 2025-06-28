
import ProjectDashboard from '@/components/ProjectDashboard';

interface ProjectPageParams {
  params: {
    projectId: string;
  };
}

// Making the component async to align with Next.js recommendations for params handling if needed,
// though direct destructuring often works for simple cases.
// No direct await needed here if projectId is always present and synchronous.
export default function ProjectPage({ params }: ProjectPageParams) {
  const { projectId } = params;

  return (
    <main>
      <ProjectDashboard projectId={projectId} />
    </main>
  );
}

// Optional: If you want to pre-render some project pages at build time (Static Site Generation)
// export async function generateStaticParams() {
//   // In a real app, fetch project IDs from a database or API
//   // For this localStorage example, this would run client-side or during build if data is available
//   // const projects = typeof window !== 'undefined' ? getProjects() : [];
//   // return projects.map((project) => ({
//   //   projectId: project.id,
//   // }));
//   return []; // Default to server-rendering on-demand for dynamic projects
// }
