import { useEffect, useState } from "react";
import api from "../services/api";

function Reports() {
  const toDateInput = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tzOffset);
    return local.toISOString().slice(0, 10);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState({
    totalInvoices: 0,
    totalSales: 0,
    totalProfit: 0,
    cashTotal: 0,
    udhaarTotal: 0,
    sales: [],
  });

  const fetchReports = async (fromDate, toDate) => {
    if (!fromDate || !toDate) return;
    try {
      setLoading(true);
      setError("");
      const res = await api.get(
        `/reports/range?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`,
      );
      setReport(res.data || {});
    } catch (err) {
      console.error(err);
      setError("Failed to load reports.");
      setReport((prev) => ({ ...prev, sales: [] }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6);
    const defaultFrom = toDateInput(start);
    const defaultTo = toDateInput(today);
    setFrom(defaultFrom);
    setTo(defaultTo);
    fetchReports(defaultFrom, defaultTo);
  }, []);

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Reports</h2>
        <p style={styles.subtitle}>
          Sales, Profit & Due Summary
        </p>
      </div>

      {/* Filters */}
      <div style={styles.filterBox}>
        <div style={styles.filterItem}>
          <label>Date From</label>
          <input
            type="date"
            style={styles.filterInput}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div style={styles.filterItem}>
          <label>Date To</label>
          <input
            type="date"
            style={styles.filterInput}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div style={styles.filterItem}>
          <label>Report Type</label>
          <select style={styles.filterInput}>
            <option>Daily Summary</option>
            <option>Monthly Profit</option>
            <option>Customer Due</option>
            <option>Product Wise</option>
          </select>
        </div>

        <button
          style={styles.filterBtn}
          onClick={() => fetchReports(from, to)}
        >
          Apply
        </button>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Sales</p>
          <h3 style={styles.cardValue}>
            {formatCurrency(report.totalSales || 0)}
          </h3>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Profit</p>
          <h3 style={styles.cardValue}>
            {formatCurrency(report.totalProfit || 0)}
          </h3>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Due</p>
          <h3 style={styles.cardValue}>
            {formatCurrency(report.udhaarTotal || 0)}
          </h3>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Bills Count</p>
          <h3 style={styles.cardValue}>
            {report.totalInvoices || 0}
          </h3>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Table */}
      <div style={styles.tableBox}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.thLeft }}>Date</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Invoice No</th>
              <th style={{ ...styles.th, ...styles.thLeft }}>Customer</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Total</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Paid</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" style={styles.emptyRow}>
                  Loading reports...
                </td>
              </tr>
            )}

            {!loading && (report.sales || []).length === 0 && (
              <tr>
                <td colSpan="6" style={styles.emptyRow}>
                  No sales found for selected dates. Try expanding the date range.
                </td>
              </tr>
            )}

            {!loading &&
              (report.sales || []).map((sale) => (
                <tr key={sale._id}>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {sale.createdAt
                      ? new Date(sale.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {sale.invoiceNumber || "-"}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdLeft }}>
                    {sale.customerName || sale.shopName || "Walk-in"}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    {formatCurrency(sale.totalAmount || 0)}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    {formatCurrency(sale.paidAmount || 0)}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdRight }}>
                    {formatCurrency(sale.pendingAmount || 0)}
                  </td>
                </tr>
              ))}
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
    marginBottom: 20,
  },

  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
  },

  subtitle: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 14,
  },

  filterBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    alignItems: "flex-end",
  },

  filterItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    color: "#6b7280",
  },

  filterBtn: {
    height: 44,
    padding: "0 18px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },

  filterInput: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 14,
    color: "#111",
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 20,
    marginBottom: 24,
  },

  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 15,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },

  cardLabel: {
    margin: 0,
    fontSize: 14,
    color: "#6b7280",
  },

  cardValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: 700,
  },

  tableBox: {
    background: "#fff",
    padding: 20,
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
  },
  tdLeft: {
    textAlign: "left",
  },
  tdRight: {
    textAlign: "right",
  },

  emptyRow: {
    textAlign: "center",
    padding: 20,
    color: "#6b7280",
  },
  error: {
    marginBottom: 12,
    padding: "10px 12px",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    fontSize: 14,
  },
};

export default Reports;
