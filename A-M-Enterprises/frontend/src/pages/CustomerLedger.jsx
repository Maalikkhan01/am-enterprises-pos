import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";

function CustomerLedger() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnSales, setReturnSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [returnType, setReturnType] = useState("STOCK_RETURN");
  const [returnNote, setReturnNote] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState("");
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data || null);
      setLedger(res.data?.ledger || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load customer ledger.");
      setCustomer(null);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenSales = async () => {
    if (!id) return;
    try {
      setReturnLoading(true);
      setReturnError("");
      const res = await api.get(`/sales/open?customerId=${id}`);
      setReturnSales(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setReturnSales([]);
      setReturnError("Failed to load open bills.");
    } finally {
      setReturnLoading(false);
    }
  };

  const fetchReturnItems = async (saleId) => {
    if (!saleId) return;
    try {
      setReturnLoading(true);
      setReturnError("");
      const res = await api.get(`/returns/${saleId}/items`);
      const items = res.data?.items || [];
      setReturnItems(
        items.map((item) => ({
          ...item,
          returnQty: "",
        })),
      );
    } catch (err) {
      console.error(err);
      setReturnItems([]);
      setReturnError("Failed to load sale items.");
    } finally {
      setReturnLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLedger();
    }
  }, [id]);

  useEffect(() => {
    if (returnOpen) {
      fetchOpenSales();
    }
  }, [returnOpen, id]);

  useEffect(() => {
    if (returnOpen && selectedSaleId) {
      fetchReturnItems(selectedSaleId);
    } else if (returnOpen) {
      setReturnItems([]);
    }
  }, [returnOpen, selectedSaleId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const sortedLedger = useMemo(() => {
    return [...ledger].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [ledger]);

  const handleReceivePayment = async () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    try {
      setPaying(true);
      setError("");
      await api.post("/customers/receive-payment", {
        customerId: id,
        amount,
      });
      setPaymentAmount("");
      setToast("Payment received successfully");
      fetchLedger();
    } catch (err) {
      console.error(err);
      setError("Failed to receive payment.");
    } finally {
      setPaying(false);
    }
  };

  const openReturnModal = () => {
    setReturnOpen(true);
    setReturnError("");
    setSelectedSaleId("");
    setReturnItems([]);
    setReturnType("STOCK_RETURN");
    setReturnNote("");
    setAdjustAmount("");
  };

  const closeReturnModal = () => {
    setReturnOpen(false);
    setReturnError("");
    setSelectedSaleId("");
    setReturnItems([]);
    setReturnNote("");
    setAdjustAmount("");
  };

  const handleReturnSubmit = async () => {
    if (!selectedSaleId) {
      setReturnError("Select a bill first.");
      return;
    }

    const adjustmentValue = Number(adjustAmount);
    if (returnType === "PRICE_ADJUSTMENT") {
      if (!adjustmentValue || adjustmentValue <= 0) {
        setReturnError("Enter a valid adjustment amount.");
        return;
      }
    }

    const itemsPayload = returnItems
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.returnQty || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (itemsPayload.length === 0) {
      setReturnError("Enter return quantity for at least one item.");
      return;
    }

    try {
      setReturnSubmitting(true);
      setReturnError("");
      await api.post(`/returns/${selectedSaleId}`, {
        items: itemsPayload,
        returnType,
        note: returnNote,
        adjustAmount:
          returnType === "PRICE_ADJUSTMENT" ? adjustmentValue : undefined,
      });
      setToast("Return processed successfully");
      closeReturnModal();
      fetchLedger();
    } catch (err) {
      console.error(err);
      setReturnError("Failed to process return.");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const dueAmount = Number(customer?.dueAmount || 0);

  if (loading) {
    return <div style={styles.center}>Loading...</div>;
  }

  return (
    <div style={styles.wrapper}>
      {toast && <div style={styles.toast}>{toast}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.customerCard}>
        <div>
          <div style={styles.customerName}>{customer?.name || "Customer"}</div>
          <div style={styles.customerPhone}>{customer?.phone || "-"}</div>
        </div>
        <div style={styles.dueBox}>
          <div style={styles.dueLabel}>Current Due</div>
          <div
            style={{
              ...styles.dueValue,
              color: dueAmount > 0 ? "#dc2626" : "#16a34a",
            }}
          >
            {formatCurrency(dueAmount)}
          </div>
        </div>
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Transactions</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thLeft }}>Date</th>
                <th style={{ ...styles.th, ...styles.thLeft }}>Type</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {sortedLedger.length === 0 && (
                <tr>
                  <td style={styles.emptyRow} colSpan="4">
                    No transactions yet for this customer.
                  </td>
                </tr>
              )}

              {sortedLedger.map((entry, idx) => {
                const type = String(entry.type || "").toUpperCase();
                const amount = Number(entry.amount || 0);
                const balance = Number(entry.balanceAfter);
                const date = entry.createdAt
                  ? new Date(entry.createdAt).toLocaleString()
                  : "-";

                return (
                  <tr key={`${entry.createdAt}-${idx}`}>
                    <td style={{ ...styles.td, ...styles.tdLeft }}>{date}</td>
                    <td
                      style={{
                        ...styles.td,
                        ...styles.tdLeft,
                        color: type === "PAYMENT" ? "#16a34a" : "#dc2626",
                        fontWeight: 600,
                      }}
                    >
                      {type || "-"}
                    </td>
                    <td style={styles.td}>{formatCurrency(amount)}</td>
                    <td style={styles.td}>
                      {Number.isFinite(balance)
                        ? formatCurrency(balance)
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Receive Payment</h3>
          <div style={styles.field}>
            <label style={styles.label}>Enter payment amount</label>
            <input
              type="number"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              style={styles.input}
              placeholder="0"
            />
          </div>
          <button
            style={styles.payBtn}
            onClick={handleReceivePayment}
            disabled={paying}
          >
            {paying ? "Processing..." : "Receive Payment"}
          </button>
          <button style={styles.returnBtn} onClick={openReturnModal}>
            Process Return
          </button>
        </div>
      </div>

      {returnOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Process Return</h3>
              <button style={styles.modalClose} onClick={closeReturnModal}>
                X
              </button>
            </div>

            {returnError && <div style={styles.returnError}>{returnError}</div>}

            <div style={styles.field}>
              <label style={styles.label}>Select Bill</label>
              <select
                style={styles.select}
                value={selectedSaleId}
                onChange={(e) => setSelectedSaleId(e.target.value)}
              >
                <option value="">Select invoice</option>
                {returnSales.map((sale) => {
                  const pending =
                    sale.pendingAmount ?? sale.balanceAmount ?? sale.dueAmount ?? 0;
                  return (
                    <option key={sale._id} value={sale._id}>
                      {sale.invoiceNumber} — {formatCurrency(pending)}
                    </option>
                  );
                })}
              </select>
              {!returnLoading && returnSales.length === 0 && (
                <div style={styles.muted}>
                  No open bills found for this customer.
                </div>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Return Type</label>
              <select
                style={styles.select}
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
              >
                <option value="STOCK_RETURN">Stock Return</option>
                <option value="PRICE_ADJUSTMENT">Price Adjustment</option>
              </select>
            </div>

            {returnType === "PRICE_ADJUSTMENT" && (
              <div style={styles.field}>
                <label style={styles.label}>Adjustment Amount</label>
                <input
                  type="number"
                  min="0"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  style={styles.input}
                  placeholder="0"
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Items</label>
              {selectedSaleId ? (
                returnLoading && returnItems.length === 0 ? (
                  <div style={styles.muted}>Loading items...</div>
                ) : returnItems.length === 0 ? (
                  <div style={styles.muted}>No items found for this bill.</div>
                ) : (
                  <div style={styles.itemsBox}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ ...styles.th, ...styles.thLeft }}>
                            Product
                          </th>
                          <th style={styles.th}>Available</th>
                          <th style={styles.th}>Return Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnItems.map((item, idx) => (
                          <tr key={`${item.productId}-${idx}`}>
                            <td style={{ ...styles.td, ...styles.tdLeft }}>
                              {item.productName}
                            </td>
                            <td style={styles.td}>
                              {Number(item.availableQty || 0)}
                            </td>
                            <td style={styles.td}>
                              <input
                                type="number"
                                min="0"
                                max={Number(item.availableQty || 0)}
                                value={item.returnQty}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setReturnItems((prev) =>
                                    prev.map((row, i) =>
                                      i === idx
                                        ? { ...row, returnQty: value }
                                        : row,
                                    ),
                                  );
                                }}
                                style={styles.qtyInput}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div style={styles.muted}>Select a bill to load items.</div>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Note (optional)</label>
              <textarea
                style={styles.textarea}
                rows="2"
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="Reason or remark"
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={closeReturnModal}>
                Cancel
              </button>
              <button
                style={styles.confirmBtn}
                onClick={handleReturnSubmit}
                disabled={returnSubmitting}
              >
                {returnSubmitting ? "Processing..." : "Submit Return"}
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
  center: {
    width: "100%",
    padding: 40,
    textAlign: "center",
    color: "#555",
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
  },
  customerCard: {
    background: "#fff",
    padding: 18,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  customerName: {
    fontSize: 22,
    fontWeight: 700,
  },
  customerPhone: {
    marginTop: 4,
    color: "#666",
  },
  dueBox: {
    textAlign: "right",
  },
  dueLabel: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dueValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 700,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 16,
  },
  card: {
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    margin: 0,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: 700,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "right",
    padding: "12px 10px",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#111",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 700,
  },
  thLeft: {
    textAlign: "left",
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
  emptyRow: {
    textAlign: "center",
    padding: 18,
    color: "#6b7280",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
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
  },
  payBtn: {
    width: "100%",
    height: 44,
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  returnBtn: {
    width: "100%",
    height: 44,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 10,
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 720,
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 14px 30px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
  },
  modalClose: {
    height: 44,
    padding: "0 12px",
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: 18,
    cursor: "pointer",
    color: "#111",
    borderRadius: 8,
  },
  select: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "#fff",
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    resize: "vertical",
  },
  itemsBox: {
    border: "1px solid #eee",
    borderRadius: 8,
    maxHeight: 240,
    overflowY: "auto",
  },
  qtyInput: {
    width: 90,
    height: 44,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 13,
    textAlign: "right",
  },
  muted: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 12,
  },
  returnError: {
    marginBottom: 10,
    padding: "8px 10px",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    fontSize: 13,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    height: 44,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    fontWeight: 600,
  },
  confirmBtn: {
    height: 44,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
};

export default CustomerLedger;
