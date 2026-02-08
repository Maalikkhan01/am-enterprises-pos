import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const emptyForm = {
  name: "",
  shopName: "",
  phone: "",
  address: "",
};

function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [topDefaulters, setTopDefaulters] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [defaultersLoading, setDefaultersLoading] = useState(false);
  const [totalDueLoading, setTotalDueLoading] = useState(false);
  const [riskMap, setRiskMap] = useState({});
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);

  const applyClientFilter = (list, term) => {
    if (!term) return list;
    const q = term.toLowerCase();
    return list.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  };

  const fetchCustomers = async (term = "") => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(
        `/customers?search=${encodeURIComponent(term)}&includeDue=1`
      );
      const data = res.data || [];
      setCustomers(applyClientFilter(data, term));
    } catch (err) {
      console.error(err);
      setError("Failed to load customers.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopDefaulters = async () => {
    try {
      setDefaultersLoading(true);
      const res = await api.get("/customers?sort=dueAmount&limit=5&includeDue=1");
      setTopDefaulters(res.data || []);
    } catch (err) {
      console.error(err);
      setTopDefaulters([]);
    } finally {
      setDefaultersLoading(false);
    }
  };

  const fetchTotalDue = async () => {
    try {
      setTotalDueLoading(true);
      const res = await api.get("/customers/total-due");
      setTotalDue(res.data?.totalDue || 0);
    } catch (err) {
      console.error(err);
      setTotalDue(0);
    } finally {
      setTotalDueLoading(false);
    }
  };

  const fetchRiskProfile = async () => {
    try {
      const res = await api.get("/customers/risk-profile");
      const list = res.data || [];
      const map = {};
      list.forEach((item) => {
        if (item.customerId) {
          map[item.customerId] = item;
        }
      });
      setRiskMap(map);
    } catch (err) {
      console.error(err);
      setRiskMap({});
    }
  };

  useEffect(() => {
    fetchCustomers("");
    fetchTopDefaulters();
    fetchTotalDue();
    fetchRiskProfile();
  }, []);

  useEffect(() => {
    const term = search.trim();
    const debounce = setTimeout(() => {
      fetchCustomers(term);
    }, 350);

    return () => clearTimeout(debounce);
  }, [search]);

  const getStatus = (customer) => {
    const due = Number(customer.dueAmount) || 0;
    if (due === 0) return { label: "Clear", color: "#16a34a" };
    if (due < 5000) return { label: "Due", color: "#d97706" };
    return { label: "High Due", color: "#dc2626" };
  };

  const getRisk = (customerId) => {
    const count = riskMap[customerId]?.overdueCount || 0;
    if (count >= 2) {
      return { label: "HIGH RISK", color: "#b91c1c", bg: "#fef2f2" };
    }
    if (count === 1) {
      return { label: "WATCH", color: "#d97706", bg: "#fff7ed" };
    }
    return { label: "SAFE", color: "#16a34a", bg: "#ecfdf3" };
  };
  const handleSave = async () => {
    const name = form.name.trim();
    const shopName = form.shopName.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();

    if (!name || !shopName || !phone || !address) {
      setError("Name, shop name, phone, and address are required.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.post("/customers", { name, shopName, phone, address });
      setShowModal(false);
      setForm(emptyForm);
      fetchCustomers(search.trim());
    } catch (err) {
      console.error(err);
      setError("Failed to add customer.");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (value) => {
    return Number(value || 0).toLocaleString();
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.topBar}>
        <h2 style={styles.title}>Customers</h2>
        <button style={styles.addBtn} onClick={() => setShowModal(true)}>
          + Add Customer
        </button>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.defaultersCard}>
          <div style={styles.cardTitle}>Top Defaulters</div>
          {defaultersLoading && (
            <div style={styles.hint}>Loading...</div>
          )}
          {!defaultersLoading && topDefaulters.length === 0 && (
            <div style={styles.hint}>No defaulters right now.</div>
          )}
          {!defaultersLoading && topDefaulters.length > 0 && (
            <ul style={styles.defaultersList}>
              {topDefaulters.map((c) => (
                <li
                  key={c._id}
                  style={styles.defaulterItem}
                  onClick={() => navigate(`/customers/${c._id}`)}
                >
                  <span>
                    ⚠ {c.name}
                  </span>
                  <span style={styles.defaulterAmount}>
                    {formatCurrency(c.dueAmount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={styles.totalDueCard}>
          <div style={styles.totalDueLabel}>Total Market Due</div>
          <div style={styles.totalDueValue}>
            {totalDueLoading ? "Loading..." : formatCurrency(totalDue)}
          </div>
        </div>
      </div>

      <div style={styles.searchRow}>
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        {loading && <span style={styles.hint}>Searching...</span>}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableBox}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.thLeft }}>Name</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Phone</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Due Amount</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Status</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && customers.length === 0 && (
              <tr>
                <td style={styles.emptyRow} colSpan="5">
                  No customers found. Try a different search.
                </td>
              </tr>
            )}

            {customers.map((customer) => {
              const status = getStatus(customer);
              const risk = getRisk(customer._id);
              return (
                <tr key={customer._id}>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    <div style={styles.nameCell}>
                      <span>{customer.name}</span>
                      <span
                        style={{
                          ...styles.riskBadge,
                          color: risk.color,
                          background: risk.bg,
                        }}
                      >
                        {risk.label}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {customer.phone || "-"}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    Rs {customer.dueAmount || 0}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft, color: status.color }}>
                    {status.label}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    <div style={styles.actionRow}>
                      <button
                        style={styles.linkBtn}
                        onClick={() => navigate(`/customers/${customer._id}`)}
                      >
                        View Ledger
                      </button>
                      <button
                        style={styles.linkBtn}
                        onClick={() => navigate("/due-recovery")}
                      >
                        Receive Payment
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Add Customer</h3>

            <div style={styles.field}>
              <label style={styles.label}>Name *</label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Shop Name *</label>
              <input
                value={form.shopName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, shopName: e.target.value }))
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Phone *</label>
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Address *</label>
              <input
                value={form.address}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, address: e.target.value }))
                }
                style={styles.input}
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button style={styles.saveBtn} onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    width: "100%",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
  },

  addBtn: {
    height: 44,
    padding: "0 16px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },

  summaryRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 16,
    marginBottom: 16,
  },

  defaultersCard: {
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },

  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 10,
  },

  defaultersList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  defaulterItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: 8,
    background: "#f8fafc",
    cursor: "pointer",
    fontSize: 14,
  },

  defaulterAmount: {
    fontWeight: 600,
  },

  totalDueCard: {
    background: "#111",
    color: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    minHeight: 96,
  },

  totalDueLabel: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.8,
  },

  totalDueValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: 700,
  },

  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },

  searchInput: {
    width: "100%",
    maxWidth: 420,
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
  },

  hint: {
    fontSize: 12,
    color: "#777",
  },

  error: {
    marginBottom: 10,
    fontSize: 12,
    color: "#b91c1c",
  },

  tableBox: {
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "12px 10px",
    fontSize: 12,
    color: "#111",
    borderBottom: "1px solid #e5e7eb",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 700,
  },

  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    textAlign: "left",
  },
  thLeft: {
    textAlign: "left",
  },
  thRight: {
    textAlign: "right",
  },
  tdLeft: {
    textAlign: "left",
  },
  tdRight: {
    textAlign: "right",
  },
  nameCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  riskBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 6px",
    borderRadius: 999,
    letterSpacing: 0.4,
  },

  emptyRow: {
    textAlign: "center",
    padding: 20,
    color: "#6b7280",
  },

  actionRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  linkBtn: {
    height: 44,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    padding: "0 12px",
    fontSize: 13,
    borderRadius: 8,
    fontWeight: 600,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },

  modal: {
    background: "#fff",
    width: 360,
    borderRadius: 12,
    padding: 18,
    boxShadow: "0 16px 30px rgba(15, 23, 42, 0.18)",
  },

  modalTitle: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 16,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
    fontSize: 14,
  },

  label: {
    fontSize: 12,
    color: "#555",
  },

  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },

  cancelBtn: {
    height: 44,
    background: "#fff",
    border: "1px solid #d1d5db",
    padding: "0 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  saveBtn: {
    height: 44,
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    padding: "0 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
};

export default Customers;
