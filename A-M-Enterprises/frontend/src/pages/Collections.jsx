import { useEffect, useState } from "react";
import api from "../services/api";

function Collections() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [openBills, setOpenBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [amounts, setAmounts] = useState({});
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);

  useEffect(() => {
    if (!query.trim()) {
      setCustomers([]);
      return;
    }

    const debounce = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(
          `/customers?search=${encodeURIComponent(query)}&limit=10&includeDue=1`
        );
        setCustomers(res.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to search customers.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query]);

  const fetchOpenBills = async (customerId) => {
    try {
      setLoading(true);
      setError("");
      const url = customerId
        ? `/sales/open?customerId=${customerId}`
        : "/sales/open";
      const res = await api.get(url);
      setOpenBills(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load open bills.");
      setOpenBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenBills();
  }, []);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomers([]);
    setQuery(customer.name);
    fetchOpenBills(customer._id);
  };

  const handlePayment = async (saleId, customerId) => {
    const amount = Number(amounts[saleId]);
    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    const targetCustomer = customerId || selectedCustomer?._id;
    if (!targetCustomer) {
      setError("Customer required for payment.");
      return;
    }

    try {
      setPaying(true);
      setError("");
      await api.post("/payments", {
        customerId: targetCustomer,
        saleId,
        amount,
        method: "cash",
      });
      setToast("Payment received successfully");
      setAmounts((prev) => ({ ...prev, [saleId]: "" }));
      fetchOpenBills(selectedCustomer?._id);
    } catch (err) {
      console.error(err);
      setError("Payment failed. Try again.");
    } finally {
      setPaying(false);
      setTimeout(() => setToast(""), 2000);
    }
  };

  return (
    <div style={styles.wrapper}>
      {toast && <div style={styles.toast}>{toast}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Collections</h3>
        <input
          type="text"
          placeholder="Search customer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.input}
        />

        {loading && <div style={styles.hint}>Loading...</div>}

        {!loading && customers.length > 0 && (
          <ul style={styles.list}>
            {customers.map((c) => (
              <li
                key={c._id}
                style={styles.listItem}
                onClick={() => handleSelectCustomer(c)}
              >
                <b>{c.name}</b>
                {c.phone && <span> • {c.phone}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.customerRow}>
          <div>
            <div style={styles.customerName}>
              {selectedCustomer ? selectedCustomer.name : "Open Bills"}
            </div>
            <div style={styles.customerPhone}>
              {selectedCustomer
                ? selectedCustomer.phone || "-"
                : "All customers with pending balance"}
            </div>
          </div>
          {selectedCustomer && (
            <div style={styles.customerDue}>
              Due: {formatCurrency(selectedCustomer.dueAmount || 0)}
            </div>
          )}
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.thLeft }}>Customer</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Shop</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Phone</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Invoice</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Date</th>
              <th style={styles.th}>Pending</th>
              <th style={styles.th}>Amount</th>
              <th style={{ ...styles.th, ...styles.thCenter }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {openBills.length === 0 && !loading && (
              <tr>
                <td style={styles.emptyRow} colSpan="8">
                  No open bills found.
                </td>
              </tr>
            )}

            {openBills.map((sale) => {
              const customerName =
                sale.customer?.name || sale.customerName || "Walk-in";
              const shopName =
                sale.customer?.shopName || sale.shopName || "-";
              const phone = sale.customer?.phone || sale.phone || "-";
              const pending =
                sale.pendingAmount ??
                sale.balanceAmount ??
                sale.dueAmount ??
                0;
              const customerId = sale.customer?._id || sale.customer;

              return (
                <tr key={sale._id}>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {customerName}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {shopName || "-"}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {phone}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {sale.invoiceNumber || "-"}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {sale.createdAt
                      ? new Date(sale.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={styles.td}>
                    {formatCurrency(pending)}
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      min="0"
                      value={amounts[sale._id] || ""}
                      onChange={(e) =>
                        setAmounts((prev) => ({
                          ...prev,
                          [sale._id]: e.target.value,
                        }))
                      }
                      style={styles.amountInput}
                      placeholder="0"
                    />
                  </td>
                  <td style={{ ...styles.td, ...styles.tdCenter }}>
                    <button
                      style={styles.payBtn}
                      onClick={() => handlePayment(sale._id, customerId)}
                      disabled={paying || !customerId}
                    >
                      Receive
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: "100%",
  },
  card: {
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    marginBottom: 16,
  },
  cardTitle: {
    margin: 0,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "#fff",
    color: "#111",
  },
  list: {
    listStyle: "none",
    margin: "10px 0 0",
    padding: 0,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  listItem: {
    padding: "12px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: "#777",
  },
  error: {
    marginBottom: 10,
    padding: "10px 12px",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    fontSize: 14,
  },
  toast: {
    marginBottom: 10,
    padding: "10px 12px",
    background: "#ecfdf3",
    color: "#166534",
    borderRadius: 8,
    fontSize: 14,
  },
  customerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 10,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 700,
  },
  customerPhone: {
    color: "#666",
    fontSize: 13,
    marginTop: 4,
  },
  customerDue: {
    fontSize: 14,
    fontWeight: 600,
    color: "#991b1b",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "right",
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#111",
    borderBottom: "1px solid #e5e7eb",
  },
  thLeft: {
    textAlign: "left",
  },
  thCenter: {
    textAlign: "center",
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
    textAlign: "right",
  },
  tdLeft: {
    textAlign: "left",
  },
  tdCenter: {
    textAlign: "center",
  },
  amountInput: {
    width: 120,
    height: 44,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    textAlign: "right",
  },
  payBtn: {
    height: 44,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  emptyRow: {
    textAlign: "center",
    padding: 16,
    color: "#6b7280",
  },
};

export default Collections;
