import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InvoicePreview from "../components/InvoicePreview";

function Invoice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(
    location.state?.invoice || null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (invoice) return;
    try {
      const raw = localStorage.getItem("lastInvoice");
      if (!raw) {
        setError("No invoice data found. Create a bill first.");
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed) {
        setError("No invoice data found. Create a bill first.");
        return;
      }
      setInvoice(parsed);
    } catch (err) {
      console.error(err);
      setError("Failed to load invoice data.");
    }
  }, [invoice]);

  if (error) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2 style={styles.title}>Invoice</h2>
          <p style={styles.error}>{error}</p>
          <button
            style={styles.primaryBtn}
            onClick={() => navigate("/billing")}
          >
            Go to Billing
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return <div style={styles.center}>Loading invoice...</div>;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <h2 style={styles.title}>Invoice</h2>
          <button
            style={styles.secondaryBtn}
            onClick={() => navigate("/billing")}
          >
            Back to Billing
          </button>
        </div>
        <InvoicePreview
          invoiceNumber={invoice.invoiceNumber}
          customer={invoice.customer}
          items={invoice.items || []}
          subtotal={invoice.subtotal}
          discount={invoice.discount}
          grandTotal={invoice.grandTotal}
          paymentReceived={invoice.paymentReceived}
          balanceDue={invoice.balanceDue}
          paymentType={invoice.paymentType}
          date={invoice.date}
          showPrint
        />
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: "100%",
    background: "#f6f7fb",
    padding: 20,
    borderRadius: 12,
  },
  center: {
    width: "100%",
    padding: 40,
    textAlign: "center",
    color: "#555",
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
  },
  error: {
    margin: "8px 0 16px",
    padding: "10px 12px",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    fontSize: 14,
  },
  primaryBtn: {
    height: 44,
    padding: "0 16px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111",
    fontWeight: 600,
    cursor: "pointer",
  },
};

export default Invoice;
