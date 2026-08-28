export default function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="module-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="empty">
        <h3>Coming in Phase 2</h3>
        <p>This module is ported from the prototype next, with real CRUD against the database.</p>
      </div>
    </>
  );
}
