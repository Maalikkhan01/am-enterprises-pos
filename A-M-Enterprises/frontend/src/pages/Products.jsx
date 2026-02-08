import { useEffect, useState } from "react";
import api from "../services/api";

const emptyForm = {
  name: "",
  sellingPrice: "",
  costPrice: "",
  stock: "",
};

function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [modalForm, setModalForm] = useState(emptyForm);
  const [quickForm, setQuickForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const normalizeProducts = (list = []) =>
    list.filter((p) => Number(p.sellingPrice) > 0);

  const getMarginValue = (product) => {
    const sellingPrice = Number(product.sellingPrice) || 0;
    const costPrice = Number(product.lastPurchaseCost) || 0;

    if (costPrice <= 0 || sellingPrice <= 0) return null;

    return ((sellingPrice - costPrice) / costPrice) * 100;
  };

  const getMarginTone = (margin) => {
    if (margin === null) return "low";
    if (margin >= 30) return "high";
    if (margin >= 15) return "medium";
    return "low";
  };

  const fetchAllProducts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/products");
      setProducts(normalizeProducts(res.data || []));
    } catch (err) {
      console.error(err);
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProducts();
  }, []);

  useEffect(() => {
    const term = search.trim();
    const debounce = setTimeout(async () => {
      if (!term) {
        fetchAllProducts();
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await api.get(
          `/products/search?search=${encodeURIComponent(term)}`,
        );
        setProducts(normalizeProducts(res.data || []));
      } catch (err) {
        console.error(err);
        setProducts([]);
        setError("Search failed. Try again.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [search]);

  const getStatus = (product) => {
    const stock = Number(product.stock) || 0;
    const minAlert = Number(product.minStockAlert) || 0;

    if (stock <= 0) return { label: "Out of Stock", tone: "danger" };
    if (stock <= minAlert) return { label: "Low Stock", tone: "warn" };
    return { label: "Active", tone: "ok" };
  };

  const applyFilters = (list = []) => {
    if (!activeFilter) return list;

    return list.filter((product) => {
      const stock = Number(product.stock) || 0;
      const minAlert = Number(product.minStockAlert) || 0;
      const margin = getMarginValue(product);

      if (activeFilter === "low") {
        return stock > 0 && stock <= minAlert;
      }

      if (activeFilter === "out") {
        return stock <= 0;
      }

      if (activeFilter === "high") {
        return margin !== null && margin >= 30;
      }

      return true;
    });
  };

  const openAddModal = () => {
    setModalMode("add");
    setModalForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setModalMode("edit");
    setModalForm({
      _id: product._id,
      name: product.name || "",
      sellingPrice: product.sellingPrice || "",
      costPrice: product.lastPurchaseCost || "",
      stock: product.stock || "",
    });
    setModalOpen(true);
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const name = quickForm.name.trim();
    const sellingPrice = Number(quickForm.sellingPrice);
    const stock = Number(quickForm.stock) || 0;

    if (!name || !sellingPrice || sellingPrice <= 0) {
      setError("Name and valid selling price are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name,
        baseUnit: "pcs",
        defaultPrices: [{ unit: "pcs", price: sellingPrice }],
        purchaseUnit: "pcs",
        stock,
        minStockAlert: 0,
        sellingPrice,
        costPrice: Number(quickForm.costPrice) || 0,
      };

      await api.post("/products", payload);
      setQuickForm(emptyForm);
      fetchAllProducts();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleModalSave = async (e) => {
    e.preventDefault();
    const name = modalForm.name.trim();
    const sellingPrice = Number(modalForm.sellingPrice);
    const stock = Number(modalForm.stock) || 0;

    if (!name || !sellingPrice || sellingPrice <= 0) {
      setError("Name and valid selling price are required.");
      return;
    }

    if (modalMode === "edit") {
      try {
        setSaving(true);
        setError("");

        const payload = {
          name,
          sellingPrice,
          costPrice: Number(modalForm.costPrice) || 0,
          stock,
        };

        const res = await api.put(`/products/${modalForm._id}`, payload);
        const updated = res.data;

        setProducts((prev) =>
          prev.map((p) => (p._id === updated._id ? updated : p)),
        );
        setModalOpen(false);
        return;
      } catch (err) {
        console.error(err);
        setError(err?.response?.data?.message || "Failed to update product.");
        return;
      } finally {
        setSaving(false);
      }
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name,
        baseUnit: "pcs",
        defaultPrices: [{ unit: "pcs", price: sellingPrice }],
        purchaseUnit: "pcs",
        stock,
        minStockAlert: 0,
        sellingPrice,
        costPrice: Number(modalForm.costPrice) || 0,
      };

      await api.post("/products", payload);
      setModalOpen(false);
      setModalForm(emptyForm);
      fetchAllProducts();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (productId) => {
    try {
      await api.patch(`/products/deactivate/${productId}`);
      setProducts((prev) => prev.filter((p) => p._id !== productId));
    } catch (err) {
      console.error(err);
      setError("Failed to deactivate product.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.title}>Products</h2>
          <p style={styles.subtitle}>Fast inventory control</p>
        </div>

        <button style={styles.addBtn} onClick={openAddModal}>
          + Add Product
        </button>
      </div>

      <div style={styles.searchRow}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product name..."
          style={styles.searchInput}
        />
        {loading && <span style={styles.searchHint}>Searching...</span>}
      </div>

      <div style={styles.filterRow}>
        <button
          style={{
            ...styles.filterBtn,
            ...(activeFilter === "low" ? styles.filterBtnActive : {}),
          }}
          onClick={() =>
            setActiveFilter((prev) => (prev === "low" ? "" : "low"))
          }
        >
          Low stock
        </button>
        <button
          style={{
            ...styles.filterBtn,
            ...(activeFilter === "out" ? styles.filterBtnActive : {}),
          }}
          onClick={() =>
            setActiveFilter((prev) => (prev === "out" ? "" : "out"))
          }
        >
          Out of stock
        </button>
        <button
          style={{
            ...styles.filterBtn,
            ...(activeFilter === "high" ? styles.filterBtnActive : {}),
          }}
          onClick={() =>
            setActiveFilter((prev) => (prev === "high" ? "" : "high"))
          }
        >
          High margin
        </button>
      </div>

      <div style={styles.quickAddCard}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Quick Add</h3>
          <span style={styles.cardHint}>Speed entry for new items</span>
        </div>

        <form style={styles.quickAddGrid} onSubmit={handleQuickAdd}>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              value={quickForm.name}
              onChange={(e) =>
                setQuickForm((prev) => ({ ...prev, name: e.target.value }))
              }
              style={styles.input}
              placeholder="Product name"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Selling Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quickForm.sellingPrice}
              onChange={(e) =>
                setQuickForm((prev) => ({
                  ...prev,
                  sellingPrice: e.target.value,
                }))
              }
              style={styles.input}
              placeholder="Rs 0"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Cost Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quickForm.costPrice}
              onChange={(e) =>
                setQuickForm((prev) => ({
                  ...prev,
                  costPrice: e.target.value,
                }))
              }
              style={styles.input}
              placeholder="Rs 0"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Opening Stock</label>
            <input
              type="number"
              min="0"
              step="1"
              value={quickForm.stock}
              onChange={(e) =>
                setQuickForm((prev) => ({ ...prev, stock: e.target.value }))
              }
              style={styles.input}
              placeholder="0"
            />
          </div>

          <button style={styles.saveBtn} type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.cardTitle}>Product List</h3>
          {error && <span style={styles.errorText}>{error}</span>}
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.thLeft }}>Name</th>
              <th style={{ ...styles.th, ...styles.thRight }}>
                Selling Price
              </th>
              <th style={{ ...styles.th, ...styles.thRight }}>
                Profit Margin
              </th>
              <th style={{ ...styles.th, ...styles.thRight }}>Stock</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Status</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && products.length === 0 && (
              <tr>
                <td style={styles.emptyRow} colSpan="6">
                  No products found. Try adjusting your search or filters.
                </td>
              </tr>
            )}

            {applyFilters(products).map((product) => {
              const status = getStatus(product);
              const margin = getMarginValue(product);
              const marginTone = getMarginTone(margin);
              const rowTone =
                status.tone === "warn"
                  ? styles.rowWarn
                  : status.tone === "danger"
                    ? styles.rowDanger
                    : undefined;
              return (
                <tr key={product._id} style={rowTone}>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {product.name}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    Rs {product.sellingPrice}
                  </td>
                  <td
                    style={{
                      ...styles.td,
                      ...styles.tdRight,
                      ...(marginTone === "high"
                        ? styles.marginHigh
                        : marginTone === "medium"
                          ? styles.marginMedium
                          : styles.marginLow),
                    }}
                  >
                    {margin === null ? "—" : `${Math.round(margin)}%`}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    {product.stock ?? 0}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    <span
                      style={{
                        ...styles.statusPill,
                        ...(status.tone === "ok"
                          ? styles.statusOk
                          : status.tone === "warn"
                            ? styles.statusWarn
                            : styles.statusDanger),
                      }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    <div style={styles.actionRow}>
                      <button
                        style={styles.editBtn}
                        onClick={() => openEditModal(product)}
                      >
                        Edit
                      </button>
                      <button
                        style={styles.deactivateBtn}
                        onClick={() => handleDeactivate(product._id)}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div style={styles.modalBackdrop} onClick={() => setModalOpen(false)}>
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.cardTitle}>
                {modalMode === "edit" ? "Edit Product" : "Add Product"}
              </h3>
              <button
                style={styles.modalClose}
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form style={styles.modalGrid} onSubmit={handleModalSave}>
              <div style={styles.field}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={modalForm.name}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  style={styles.input}
                  placeholder="Product name"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Selling Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modalForm.sellingPrice}
                  onChange={(e) =>
                    setModalForm((prev) => ({
                      ...prev,
                      sellingPrice: e.target.value,
                    }))
                  }
                  style={styles.input}
                  placeholder="Rs 0"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Cost Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modalForm.costPrice}
                  onChange={(e) =>
                    setModalForm((prev) => ({
                      ...prev,
                      costPrice: e.target.value,
                    }))
                  }
                  style={styles.input}
                  placeholder="Rs 0"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Opening Stock</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={modalForm.stock}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, stock: e.target.value }))
                  }
                  style={styles.input}
                  placeholder="0"
                />
              </div>

              <button style={styles.saveBtn} type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    width: "100%",
    padding: 24,
    borderRadius: 12,
    color: "#111",
    background: "#f6f7fb",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 0.2,
  },

  subtitle: {
    marginTop: 6,
    color: "#475569",
    fontSize: 13,
  },

  addBtn: {
    height: 44,
    padding: "0 18px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },

  searchInput: {
    flex: 1,
    minWidth: 220,
    maxWidth: 420,
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 14,
    outline: "none",
  },

  searchHint: {
    fontSize: 12,
    color: "#6b7280",
  },

  filterRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  filterBtn: {
    height: 44,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 12,
    color: "#334155",
    cursor: "pointer",
  },

  filterBtnActive: {
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
  },

  quickAddCard: {
    background: "#fff",
    padding: 18,
    borderRadius: 12,
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",
    marginBottom: 20,
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: "#111",
  },

  cardHint: {
    fontSize: 12,
    color: "#6b7280",
  },

  quickAddGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    alignItems: "end",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  label: {
    fontSize: 12,
    color: "#6b7280",
  },

  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
  },

  saveBtn: {
    height: 44,
    padding: "0 16px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  tableCard: {
    background: "#fff",
    padding: 18,
    borderRadius: 12,
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",
  },

  tableHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "12px 10px",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#111",
    fontWeight: 700,
    borderBottom: "1px solid #e5e7eb",
  },
  thLeft: {
    textAlign: "left",
  },
  thRight: {
    textAlign: "right",
  },

  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    textAlign: "left",
  },
  tdLeft: {
    textAlign: "left",
  },
  tdRight: {
    textAlign: "right",
  },

  marginHigh: {
    color: "#166534",
    fontWeight: 600,
  },

  marginMedium: {
    color: "#a16207",
    fontWeight: 600,
  },

  marginLow: {
    color: "#991b1b",
    fontWeight: 600,
  },

  emptyRow: {
    textAlign: "center",
    padding: 20,
    color: "#6b7280",
    fontSize: 13,
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },

  statusOk: {
    background: "#f0fdf4",
    color: "#166534",
  },

  statusWarn: {
    background: "#fffbeb",
    color: "#92400e",
  },

  statusDanger: {
    background: "#fef2f2",
    color: "#991b1b",
  },
  rowWarn: {
    background: "#fffbeb",
  },
  rowDanger: {
    background: "#fef2f2",
  },

  actionRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  editBtn: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#1e293b",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  deactivateBtn: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#991b1b",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  errorText: {
    color: "#b91c1c",
    fontSize: 12,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },

  modalCard: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  modalClose: {
    height: 44,
    padding: "0 12px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: 12,
    borderRadius: 8,
    fontWeight: 600,
  },

  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
    alignItems: "end",
  },
};

export default Products;
