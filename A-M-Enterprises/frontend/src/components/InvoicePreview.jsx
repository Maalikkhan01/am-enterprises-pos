function InvoicePreview({
  invoiceNumber = "INV-001",
  date = new Date(),
  shopName = "A M Enterprises",
  shopAddress = "Pandhurna, Madhya Pradesh",
  customer,
  items = [],
  total = 0,
  subtotal,
  discount = 0,
  grandTotal,
  paymentReceived = 0,
  balanceDue,
  paymentType = "CASH",
  showPrint = true,
}) {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);
  const handlePrint = () => {
    window.print();
  };

  const customerName =
    customer && typeof customer === "object"
      ? customer.name
      : customer || "Walk-in";
  const customerPhone =
    customer && typeof customer === "object" ? customer.phone : "";

  const computedSubtotal = Number.isFinite(Number(subtotal))
    ? Number(subtotal)
    : Number(total) || 0;
  const computedDiscount = Math.max(0, Number(discount) || 0);
  const computedGrandTotal = Number.isFinite(Number(grandTotal))
    ? Number(grandTotal)
    : Math.max(0, computedSubtotal - computedDiscount);
  const computedPayment = Math.max(0, Number(paymentReceived) || 0);
  const computedBalance = Number.isFinite(Number(balanceDue))
    ? Number(balanceDue)
    : Math.max(0, computedGrandTotal - computedPayment);

  return (
    <>
      {/* PRINT BUTTON (screen only) */}
      {showPrint && (
        <div style={styles.printBar} className="no-print">
          <button style={styles.printBtn} onClick={handlePrint}>
            Print Invoice
          </button>
        </div>
      )}

      {/* INVOICE */}
      <div style={styles.invoice} id="invoice">
        {/* Shop */}
        <div style={styles.center}>
          <h2 style={styles.shopName}>{shopName}</h2>
          <p style={styles.small}>{shopAddress}</p>
        </div>

        <hr />

        {/* Invoice Info */}
        <div style={styles.row}>
          <span>Invoice:</span>
          <span>{invoiceNumber}</span>
        </div>

        <div style={styles.row}>
          <span>Date:</span>
          <span>
            {new Date(date).toLocaleDateString()}
          </span>
        </div>

        <hr />

        {/* Customer */}
        <div style={styles.section}>
          <b>Customer:</b> {customerName || "Walk-in"}
          {customerPhone ? ` • ${customerPhone}` : ""}
        </div>

        {/* Items */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th align="left" style={styles.th}>Item</th>
              <th align="right" style={styles.th}>Qty</th>
              <th align="right" style={styles.th}>Price</th>
              <th align="right" style={styles.th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={idx}>
                <td style={styles.td}>{i.name}</td>
                <td align="right" style={styles.td}>{i.qty}</td>
                <td align="right" style={styles.td}>
                  {formatCurrency(Number(i.price) || 0)}
                </td>
                <td align="right" style={styles.td}>
                  {formatCurrency(
                    Number(i.price) * Number(i.qty) || 0
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr />

        {/* Total */}
        <div style={styles.row}>
          <span>Subtotal:</span>
          <span>{formatCurrency(computedSubtotal)}</span>
        </div>

        {computedDiscount > 0 && (
          <div style={styles.row}>
            <span>Discount:</span>
            <span>- {formatCurrency(computedDiscount)}</span>
          </div>
        )}

        <div style={styles.totalRow}>
          <b>Grand Total</b>
          <b>{formatCurrency(computedGrandTotal)}</b>
        </div>

        <div style={styles.row}>
          <span>Payment:</span>
          <span>{paymentType}</span>
        </div>

        {computedPayment > 0 && (
          <div style={styles.row}>
            <span>Paid:</span>
            <span>{formatCurrency(computedPayment)}</span>
          </div>
        )}

        {computedBalance > 0 && (
          <div style={styles.row}>
            <span>Balance:</span>
            <span>{formatCurrency(computedBalance)}</span>
          </div>
        )}

        <hr />

        {/* Footer */}
        <div style={styles.center}>
          <p style={styles.small}>
            Thank you for your business.
          </p>
          <p style={styles.xsmall}>
            Computer generated invoice
          </p>
        </div>
      </div>

      {/* PRINT CSS */}
      <style>{printStyles}</style>
    </>
  );
}

const styles = {
  printBar: {
    marginBottom: 12,
    textAlign: "right",
  },

  printBtn: {
    height: 44,
    padding: "0 14px",
    border: "1px solid #111",
    borderRadius: 8,
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },

  invoice: {
    width: 340,
    maxWidth: "100%",
    margin: "0 auto",
    background: "#fff",
    padding: 16,
    fontFamily: "monospace",
    fontSize: 13,
    color: "#000",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
  },

  shopName: {
    margin: 0,
    fontSize: 18,
  },

  center: {
    textAlign: "center",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    margin: "4px 0",
  },

  section: {
    margin: "6px 0",
    fontSize: 12,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    marginTop: 6,
  },
  th: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#555",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 4,
  },
  td: {
    padding: "4px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 15,
    marginTop: 6,
  },

  small: {
    fontSize: 11,
    margin: 0,
  },

  xsmall: {
    fontSize: 10,
    margin: 0,
  },
};

const printStyles = `
@media print {
  body * {
    visibility: hidden;
  }

  #invoice, #invoice * {
    visibility: visible;
  }

  #invoice {
    position: absolute;
    left: 0;
    top: 0;
    border: none;
    box-shadow: none;
    width: 280px;
    padding: 10px;
  }

  .no-print {
    display: none;
  }
}
`;

export default InvoicePreview;
