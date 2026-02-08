import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    cashCollected: 0,
    dueGenerated: 0,
    paymentsReceived: 0,
    profit: 0,
    lowStockCount: 0,
    lowStock: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError("");
      const [daily, cash, profit, lowStock] = await Promise.all([
        api.get("/reports/daily-summary"),
        api.get("/reports/today-cash"),
        api.get("/reports/today-profit"),
        api.get("/products/low-stock?limit=100"),
      ]);

      const lowStockItems = Array.isArray(lowStock.data)
        ? lowStock.data
        : [];

      setMetrics({
        todaySales: daily.data?.totalSalesAmount || 0,
        cashCollected: cash.data?.totalCash || 0,
        dueGenerated: daily.data?.totalUdhaarAdded || 0,
        paymentsReceived: cash.data?.receivedPayments || 0,
        profit: profit.data?.profit || 0,
        lowStockCount: lowStockItems.length,
        lowStock: lowStockItems,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard data.");
      setMetrics((prev) => ({
        ...prev,
        lowStock: [],
        lowStockCount: 0,
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const cards = [
    {
      label: "Today's Total Sales",
      value: formatCurrency(metrics.todaySales),
    },
    {
      label: "Cash Collected",
      value: formatCurrency(metrics.cashCollected),
    },
    {
      label: "Total Due Generated",
      value: formatCurrency(metrics.dueGenerated),
    },
    {
      label: "Payments Received",
      value: formatCurrency(metrics.paymentsReceived),
    },
    {
      label: "Profit",
      value: formatCurrency(metrics.profit),
    },
    {
      label: "Low Stock Count",
      value: metrics.lowStockCount,
      onClick: () => navigate("/products"),
    },
  ];

  return (
    <div>
      <div style={styles.welcomeCard}>
        <h2 style={styles.welcomeTitle}>Welcome to A M Enterprises</h2>
        <p style={styles.welcomeSubtitle}>
          Owner control center for today's performance
        </p>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button style={styles.retryBtn} onClick={fetchMetrics}>
            Retry
          </button>
        </div>
      )}

      <div style={styles.cardGrid}>
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              ...styles.card,
              ...(card.onClick ? styles.clickableCard : {}),
            }}
            onClick={card.onClick}
          >
            <p style={styles.cardLabel}>{card.label}</p>
            <h3 style={styles.cardValue}>
              {loading ? "Loading..." : card.value}
            </h3>
          </div>
        ))}
      </div>

      <div style={styles.infoCard}>
        <h4 style={styles.infoTitle}>Low Stock Alerts</h4>
        <ul style={styles.infoList}>
          {loading && <li>Loading low stock items...</li>}
          {!loading && metrics.lowStock.length === 0 && (
            <li>All good, no low stock items today.</li>
          )}
          {!loading &&
            metrics.lowStock.map((item) => (
              <li key={item._id}>
                {item.name} — {item.stock} left
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

const styles = {
  welcomeCard: {
    background: "#ffffff",
    padding: 24,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    marginBottom: 24,
  },

  welcomeTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
  },

  welcomeSubtitle: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 14,
  },

  error: {
    marginBottom: 16,
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

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 20,
    marginBottom: 24,
  },

  card: {
    background: "#ffffff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },
  clickableCard: {
    cursor: "pointer",
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

  infoCard: {
    background: "#ffffff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },

  infoTitle: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: 600,
  },

  infoList: {
    paddingLeft: 18,
    color: "#6b7280",
    lineHeight: 1.8,
  },
};

export default Dashboard;
