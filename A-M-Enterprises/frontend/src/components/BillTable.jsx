import { useEffect, useRef } from "react";
import { X } from "lucide-react";

function BillTable({
  items,
  setItems,
  selectedItemId,
  onSelectItem,
  focusItemId,
  onQtyEnter,
}) {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);
  const qtyRefs = useRef({});

  useEffect(() => {
    if (focusItemId && qtyRefs.current[focusItemId]) {
      qtyRefs.current[focusItemId].focus();
      qtyRefs.current[focusItemId].select?.();
    }
  }, [focusItemId, items.length]);

  const updateQty = (id, qty) => {
    setItems((prev) =>
      prev.map((i) =>
        i._id === id ? { ...i, qty: Number(qty) || 1 } : i
      )
    );
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i._id !== id));
    if (onSelectItem && selectedItemId === id) {
      onSelectItem(null);
    }
  };

  if (items.length === 0) {
    return (
      <p style={styles.empty}>
        No items yet. Use the search above to add products.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <table style={styles.table} width="100%">
        <thead>
          <tr>
            <th style={styles.th}>Item</th>
            <th style={{ ...styles.th, ...styles.thRight }} width="90">
              Price
            </th>
            <th style={{ ...styles.th, ...styles.thRight }} width="90">
              Qty
            </th>
            <th style={{ ...styles.th, ...styles.thRight }} width="100">
              Total
            </th>
            <th style={{ ...styles.th, ...styles.thCenter }} width="56">
              X
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const rowTotal =
              Number(i.price) && Number(i.qty)
                ? Number(i.price) * Number(i.qty)
                : 0;

            return (
              <tr
                key={i._id}
                style={
                  selectedItemId === i._id ? styles.rowSelected : undefined
                }
                onClick={() => onSelectItem?.(i._id)}
              >
                <td style={{ ...styles.cell, ...styles.cellLeft }}>
                  {i.name}
                </td>
                <td style={styles.cell}>
                  {formatCurrency(Number(i.price) || 0)}
                </td>
                <td style={styles.cell}>
                  <input
                    type="number"
                    min="1"
                    value={i.qty}
                    style={styles.qtyInput}
                    ref={(el) => {
                      if (el) qtyRefs.current[i._id] = el;
                    }}
                    onChange={(e) =>
                      updateQty(i._id, e.target.value)
                    }
                    onFocus={(e) => {
                      onSelectItem?.(i._id);
                      e.target.select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onQtyEnter?.();
                      }
                    }}
                  />
                </td>
                <td style={styles.cell}>{formatCurrency(rowTotal)}</td>
                <td style={{ ...styles.cell, ...styles.cellCenter }}>
                  <button
                    style={styles.removeBtn}
                    onClick={() => removeItem(i._id)}
                    aria-label="Remove item"
                  >
                    <X size={18} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 1,
    textAlign: "left",
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 700,
    color: "#111",
    borderBottom: "1px solid #e5e7eb",
  },
  thRight: {
    textAlign: "right",
  },
  thCenter: {
    textAlign: "center",
  },
  cell: {
    padding: "14px 10px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    color: "#111",
    textAlign: "right",
    verticalAlign: "middle",
  },
  cellLeft: {
    textAlign: "left",
  },
  cellCenter: {
    textAlign: "center",
  },
  qtyInput: {
    width: 84,
    height: 44,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    color: "#111",
    background: "#fff",
    fontSize: 14,
    textAlign: "right",
  },
  removeBtn: {
    height: 44,
    width: 44,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#b91c1c",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 18,
    borderRadius: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rowSelected: {
    background: "#f8fafc",
  },
  empty: {
    margin: 0,
    padding: "14px 0",
    color: "#6b7280",
    fontSize: 14,
  },
};

export default BillTable;
