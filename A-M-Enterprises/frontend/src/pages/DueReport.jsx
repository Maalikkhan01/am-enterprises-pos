import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

function DueReport() {
  const [customers, setCustomers] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);

  const fetchDueReport = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/reports/due");
      const list = Array.isArray(res.data?.customers)
        ? res.data.customers
        : [];
      setCustomers(list);
      setTotalDue(res.data?.totalDue || 0);
    } catch (err) {
      console.error(err);
      setError("Failed to load due report.");
      setCustomers([]);
      setTotalDue(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDueReport();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const sortedCustomers = useMemo(() => {
    return [...customers].sort(
      (a, b) => (Number(b.dueAmount) || 0) - (Number(a.dueAmount) || 0),
    );
  }, [customers]);

  const handleReceivePayment = async (customer) => {
    const amount = Number(amounts[customer._id]);
    const due = Number(customer.dueAmount || 0);

    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (amount > due) {
      setError("Payment exceeds due amount.");
      return;
    }

    try {
      setPayingId(customer._id);
      setError("");
      const res = await api.post("/customers/receive-payment", {
        customerId: customer._id,
        amount,
      });
      const updatedDue = Math.max(
        0,
        Number(res.data?.customer?.dueAmount ?? due - amount),
      );

      setCustomers((prev) => {
        const next = prev
          .map((c) =>
            c._id === customer._id
              ? { ...c, dueAmount: updatedDue }
              : c,
          )
          .filter((c) => Number(c.dueAmount || 0) > 0);
        setTotalDue(
          next.reduce((sum, c) => sum + (Number(c.dueAmount) || 0), 0),
        );
        return next;
      });

      setAmounts((prev) => ({ ...prev, [customer._id]: "" }));
      setToast("Payment received successfully.");
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Payment failed. Try again.");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div style={styles.wrapper}>
      {toast && <div style={styles.toast}>{toast}</div>}
      {error && (
        <div style={styles.error}>
          {error}
          <button style={styles.retryBtn} onClick={fetchDueReport}>
            Retry
          </button>
        </div>
      )}

      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Due Recovery</h2>
          <p style={styles.subtitle}>
            Customers with outstanding dues
          </p>
        </div>
        <div style={styles.summaryBox}>
          <div style={styles.summaryLabel}>Total Due</div>
          <div style={styles.summaryValue}>{formatCurrency(totalDue)}</div>
          <div style={styles.summaryHint}>
            Customers: {sortedCustomers.length}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.thLeft }}>Customer</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Phone</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Total Due</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Amount</th>
              <th style={{ ...styles.th, ...styles.thCenter }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td style={styles.emptyRow} colSpan="5">
                  Loading due report...
                </td>
              </tr>
            )}

            {!loading && sortedCustomers.length === 0 && (
              <tr>
                <td style={styles.emptyRow} colSpan="5">
                  No dues found. All customers are clear.
                </td>
              </tr>
            )}

            {!loading &&
              sortedCustomers.map((customer) => {
                const due = Number(customer.dueAmount || 0);
                return (
                  <tr key={customer._id}>
                    <td style={{ ...styles.td, ...styles.tdLeft }}>
                      {customer.name || "Customer"}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdLeft }}>
                      {customer.phone || "-"}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      {formatCurrency(due)}
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>
                      <input
                        type="number"
                        min="0"
                        max={due}
                        placeholder="0"
                        value={amounts[customer._id] || ""}
                        onChange={(e) =>
                          setAmounts((prev) => ({
                            ...prev,
                            [customer._id]: e.target.value,
                          }))
                        }
                        style={styles.amountInput}
                      />
                    </td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>
                      <button
                        style={styles.payBtn}
                        onClick={() => handleReceivePayment(customer)}
                        disabled={payingId === customer._id}
                      >
                        {payingId === customer._id ? "Processing..." : "Receive"}
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
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 14,
  },
  summaryBox: {
    background: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
    minWidth: 220,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
  },
  summaryHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  card: {
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",
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
    height: 40,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    textAlign: "right",
  },
  payBtn: {
    height: 40,
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
    padding: 18,
    color: "#6b7280",
  },
  toast: {
    marginBottom: 12,
    padding: "10px 12px",
    background: "#ecfdf3",
    color: "#166534",
    borderRadius: 8,
    fontSize: 14,
  },
  error: {
    marginBottom: 12,
    padding: "10px 12px",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  retryBtn: {
    height: 36,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #b91c1c",
    background: "#fff",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  },
};

export default DueReport;
