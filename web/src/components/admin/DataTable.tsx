interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  items: T[];
  total?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  items,
  total,
  page = 1,
  onPageChange,
  isLoading,
}: DataTableProps<T>) {
  if (isLoading) {
    return <p className="placeholder-note">Loading...</p>;
  }

  if (items.length === 0) {
    return <p className="placeholder-note">No data.</p>;
  }

  const limit = 20;
  const totalPages = total ? Math.ceil(total / limit) : 1;

  return (
    <div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={(item.id ?? item._id ?? i) as string}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(item) : String(item[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="admin-pagination">
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            Previous
          </button>
          <span className="admin-page-info">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
