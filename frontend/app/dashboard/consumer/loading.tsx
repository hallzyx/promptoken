/**
 * Loading skeleton for the consumer dashboard.
 */
export default function ConsumerDashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="skeleton mb-8 h-10 w-72 rounded" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
