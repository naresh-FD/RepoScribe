export interface DashboardProps {
  /** Heading shown above the dashboard. */
  title: string;
}

/** Main dashboard route for the fixture application. */
export function Dashboard({ title }: DashboardProps) {
  return <main><h1>{title}</h1></main>;
}
