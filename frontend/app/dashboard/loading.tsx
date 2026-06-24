/**
 * Loading skeleton for the dashboard page.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="skeleton mb-8 h-10 w-64 rounded" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
        <div>
          <div className="skeleton h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
