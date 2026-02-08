import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomerSearch from "../components/CustomerSearch";
import ProductSearch from "../components/ProductSearch";
import BillTable from "../components/BillTable";
import api from "../services/api";
import InvoicePreview from "../components/InvoicePreview";
import ErrorBoundary from "../components/ErrorBoundary";

function BillingContent() {
  // ✅ SINGLE SOURCE OF TRUTH
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const productSearchRef = useRef(null);
  const customerSearchRef = useRef(null);
  const navigate = useNavigate();
  const [lastSale, setLastSale] = useState(null);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [focusItemId, setFocusItemId] = useState(null);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("info");
  const [clearSearchTick, setClearSearchTick] = useState(0);
  const [paymentReceived, setPaymentReceived] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const overLimitRef = useRef(false);
  const draftKey = "draftBill";
  const idempotencyKeyStorage = "pendingSaleKey";
  const [holdBills, setHoldBills] = useState(() => {
    try {
      const raw = localStorage.getItem("holdBills");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  // ✅ SUPER FAST TOTAL (useMemo prevents re-calc lag)
  const total = useMemo(() => {
    return items.reduce((sum, i) => {
      const price = Number(i.price);
      const qty = Number(i.qty);

      if (!price || !qty) return sum;

      return sum + price * qty;
    }, 0);
  }, [items]);

  const adjustmentValue = useMemo(() => {
    return Math.max(0, Number(adjustment) || 0);
  }, [adjustment]);

  const grandTotal = useMemo(() => {
    return Math.max(0, total - adjustmentValue);
  }, [total, adjustmentValue]);

  const paymentValue = useMemo(() => {
    return Math.max(0, Number(paymentReceived) || 0);
  }, [paymentReceived]);

  const balanceDue = useMemo(() => {
    return Math.max(0, grandTotal - paymentValue);
  }, [grandTotal, paymentValue]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  }, [items]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);

  const showToast = useCallback((message, type = "info") => {
    setToast(message);
    setToastType(type);
  }, []);

  const resetBill = useCallback(() => {
    setCustomer(null);
    setItems([]);
    setSelectedItemId(null);
    setFocusItemId(null);
    setClearSearchTick((tick) => tick + 1);
    setPaymentReceived("");
    setAdjustment("");
    localStorage.removeItem(draftKey);
    localStorage.removeItem(idempotencyKeyStorage);
  }, []);

  const saveHoldBills = (list) => {
    localStorage.setItem("holdBills", JSON.stringify(list));
  };

  const handleHoldBill = () => {
    if (items.length === 0) {
      alert("Add at least one product");
      return;
    }

    const deliveryAddress = customer?.address || "N/A";
    const newHold = {
      customer,
      items,
      total,
      paymentReceived,
      adjustment,
      deliveryAddress,
      timestamp: Date.now(),
    };

    const next = [...holdBills, newHold];
    setHoldBills(next);
    saveHoldBills(next);
    resetBill();
  };

  const handleResumeBill = (e) => {
    const index = Number(e.target.value);

    if (Number.isNaN(index)) {
      return;
    }

    const bill = holdBills[index];
    if (!bill) {
      return;
    }

    setCustomer(bill.customer || null);
    setItems(bill.items || []);
    setPaymentReceived(bill.paymentReceived || "");
    setAdjustment(bill.adjustment || "");
  };

  const handleProductAdded = useCallback((productId) => {
    if (!productId) return;
    setFocusItemId(productId);
    setSelectedItemId(productId);
  }, []);

  const getOrCreateIdempotencyKey = useCallback(() => {
    const existing = localStorage.getItem(idempotencyKeyStorage);
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sale_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(idempotencyKeyStorage, generated);
    return generated;
  }, []);

  // ✅ CREATE BILL
  const handleCreateBill = useCallback(async () => {
    if (isCreating) {
      return;
    }

    if (items.length === 0) {
      showToast("Add at least one product", "error");
      return;
    }

    const invalidItem = items.find((i) => {
      const price = Number(i.price);
      const qty = Number(i.qty);
      return !price || price <= 0 || !qty || qty <= 0;
    });

    if (invalidItem) {
      showToast("Invalid item quantity or price", "error");
      return;
    }

    const rawAdjustment = Number(adjustment);
    if (Number.isFinite(rawAdjustment) && rawAdjustment < 0) {
      showToast("Adjustment cannot be negative", "error");
      return;
    }

    const rawPayment = Number(paymentReceived);
    if (Number.isFinite(rawPayment) && rawPayment < 0) {
      showToast("Payment cannot be negative", "error");
      return;
    }

    if (adjustmentValue > total) {
      showToast("Adjustment cannot exceed total", "error");
      return;
    }

    if (paymentValue > grandTotal) {
      showToast("Payment cannot exceed payable amount", "error");
      return;
    }

    const deliveryAddress = customer?.address || "N/A";
    const payload = {
      customerId: customer?._id || null,
      deliveryAddress,
      paymentReceived: paymentValue,
      discount: adjustmentValue,
      items: items.map((i) => ({
        productId: i._id,
        qty: i.qty,
        price: i.price,
      })),
    };

    try {
      setIsCreating(true);
      const idempotencyKey = getOrCreateIdempotencyKey();
      const res = await api.post("/sales", payload, {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      });

      const createdSale = res.data || null;
      const statusLabel =
        paymentValue >= grandTotal || grandTotal === 0
          ? "PAID"
          : paymentValue > 0
            ? "PARTIAL"
            : "PAYMENT PENDING";

      showToast(`BILL CREATED — ${statusLabel}`, "success");
      setLastSale(createdSale);
      const invoiceData = {
        invoiceNumber:
          createdSale?.invoiceNumber || `INV-${Date.now()}`,
        customer,
        items,
        subtotal: total,
        discount: adjustmentValue,
        grandTotal,
        paymentReceived: paymentValue,
        balanceDue,
        paymentType:
          createdSale?.paymentStatus ||
          (paymentValue >= grandTotal || grandTotal === 0
            ? "PAID"
            : paymentValue > 0
              ? "PARTIAL"
              : "OPEN"),
        date: createdSale?.createdAt || new Date().toISOString(),
      };

      setLastInvoice(invoiceData);
      localStorage.setItem("lastInvoice", JSON.stringify(invoiceData));

      // RESET BILL
      resetBill();
    } catch (error) {
      console.error(error);
      const status = error?.response?.status;
      if (status && status >= 400 && status < 500) {
        localStorage.removeItem(idempotencyKeyStorage);
      }
      showToast("Failed to create bill", "error");
    } finally {
      setIsCreating(false);
    }
  }, [
    adjustment,
    adjustmentValue,
    balanceDue,
    customer,
    getOrCreateIdempotencyKey,
    grandTotal,
    isCreating,
    items,
    paymentReceived,
    paymentValue,
    resetBill,
    showToast,
    total,
  ]);

  const handleEmptySearchEnter = useCallback(() => {
    if (items.length > 0) {
      handleCreateBill();
    } else {
      showToast("Add at least one product", "error");
    }
  }, [items.length, handleCreateBill, showToast]);

  useEffect(() => {
    productSearchRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return;

      if (parsed.items.length > 0 || parsed.customer) {
        setCustomer(parsed.customer || null);
        setItems(parsed.items || []);
        setPaymentReceived(parsed.paymentReceived || "");
        setAdjustment(parsed.adjustment || "");
        showToast("Draft bill restored", "info");
      }
    } catch (e) {
      // ignore draft load errors
    }
  }, [showToast]);

  useEffect(() => {
    const hasDraft = items.length > 0 || customer;

    if (!hasDraft) {
      localStorage.removeItem(draftKey);
      return;
    }

    const payload = {
      customer,
      items,
      paymentReceived,
      adjustment,
      timestamp: Date.now(),
    };

    localStorage.setItem(draftKey, JSON.stringify(payload));
  }, [items, customer, paymentReceived, adjustment]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (items.length === 0 && selectedItemId) {
      setSelectedItemId(null);
    }
  }, [items.length, selectedItemId]);

  useEffect(() => {
    if (items.length > 100) {
      if (!overLimitRef.current) {
        showToast("Too many items in one bill", "error");
        overLimitRef.current = true;
      }
      return;
    }

    overLimitRef.current = false;
  }, [items.length, showToast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "F1") {
        e.preventDefault();
        productSearchRef.current?.focus();
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        customerSearchRef.current?.focus();
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();
        handleCreateBill();
        return;
      }

      if (e.key === "Escape") {
        if (isTyping) {
          return;
        }
        e.preventDefault();
        if (items.length > 0 || customer) {
          resetBill();
          showToast("Bill cancelled", "info");
        } else {
          setClearSearchTick((tick) => tick + 1);
        }
        productSearchRef.current?.focus();
        return;
      }

      if (e.key === "Enter" && e.ctrlKey) {
        return;
      }

      if (e.key.toLowerCase() === "s" && e.ctrlKey) {
        e.preventDefault();
        handleCreateBill();
        return;
      }

      if (e.key === "Delete") {
        const inProductSearch = e.target === productSearchRef.current;
        if (isTyping && (!inProductSearch || e.target.value)) {
          return;
        }
        if (selectedItemId) {
          e.preventDefault();
          setItems((prev) =>
            prev.filter((i) => i._id !== selectedItemId)
          );
          setSelectedItemId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateBill, selectedItemId, items.length, customer, resetBill, showToast]);

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 900);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div style={styles.wrapper}>
      {toast && (
        <div
          style={{
            ...styles.toast,
            ...(toastType === "error"
              ? styles.toastError
              : toastType === "success"
                ? styles.toastSuccess
                : styles.toastInfo),
          }}
        >
          {toast}
        </div>
      )}
      <div
        style={{
          ...styles.grid,
          gridTemplateColumns: isNarrow ? "1fr" : "2fr 1fr",
        }}
      >
        {/* LEFT: Products + Bill */}
        <div style={styles.leftCol}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Products</h3>
            <div style={styles.searchWrap}>
              <ProductSearch
                items={items}
                onAdd={setItems}
                inputRef={productSearchRef}
                onProductAdded={handleProductAdded}
                onEmptyEnter={handleEmptySearchEnter}
                clearSignal={clearSearchTick}
              />
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Bill Items</h3>
            <div style={styles.tableScroll}>
              <BillTable
                items={items}
                setItems={setItems}
                selectedItemId={selectedItemId}
                onSelectItem={setSelectedItemId}
                focusItemId={focusItemId}
                onQtyEnter={() => productSearchRef.current?.focus()}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Customer + Total + Payment/Adjustment */}
        <div style={styles.rightCol}>
          <div style={styles.cardMuted}>
            <h4 style={styles.cardTitleSmall}>Customer (Optional)</h4>
            <CustomerSearch
              onSelect={setCustomer}
              inputRef={customerSearchRef}
            />
            <div style={styles.detailsGrid}>
              <div style={styles.fieldBlock}>
                <label style={styles.fieldLabel}>Owner Name</label>
                <input
                  type="text"
                  value={customer?.name || ""}
                  placeholder="Select customer"
                  readOnly
                  style={styles.fieldInput}
                />
              </div>
              <div style={styles.fieldBlock}>
                <label style={styles.fieldLabel}>Shop Name</label>
                <input
                  type="text"
                  value={customer?.shopName || ""}
                  placeholder="Select customer"
                  readOnly
                  style={styles.fieldInput}
                />
              </div>
              <div style={styles.fieldBlock}>
                <label style={styles.fieldLabel}>Phone</label>
                <input
                  type="text"
                  value={customer?.phone || ""}
                  placeholder="Select customer"
                  readOnly
                  style={styles.fieldInput}
                />
              </div>
              <div style={styles.fieldBlock}>
                <label style={styles.fieldLabel}>Address</label>
                <input
                  type="text"
                  value={customer?.address || ""}
                  placeholder="Select customer"
                  readOnly
                  style={styles.fieldInput}
                />
              </div>
            </div>
            {customer && (
              <p style={styles.selectedText}>
                Selected: <b>{customer.name}</b>
              </p>
            )}
          </div>

          <div style={styles.totalCard}>
            <div style={styles.totalLabel}>Grand Total</div>
            <div style={styles.totalValue}>
              {formatCurrency(grandTotal)}
            </div>
            <div style={styles.totalBreakdown}>
              <div style={styles.totalRow}>
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {adjustmentValue > 0 && (
                <div style={styles.totalRow}>
                  <span>Adjustment</span>
                  <span>- {formatCurrency(adjustmentValue)}</span>
                </div>
              )}
              <div style={styles.totalRowStrong}>
                <span>Payable</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
              {paymentValue > 0 && (
                <div style={styles.totalRow}>
                  <span>Received</span>
                  <span>{formatCurrency(paymentValue)}</span>
                </div>
              )}
              {balanceDue > 0 && (
                <div style={styles.totalRow}>
                  <span>Balance</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>

          <div style={styles.cardMuted}>
            <h4 style={styles.cardTitleSmall}>Payment / Adjustment</h4>
            <div style={styles.paymentGroup}>
              <div style={styles.paymentField}>
                <label style={styles.paymentLabel}>Payment Received</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter amount"
                  className="billing-input"
                  style={styles.paymentInput}
                  value={paymentReceived}
                  onChange={(e) => setPaymentReceived(e.target.value)}
                />
              </div>
              <div style={styles.paymentField}>
                <label style={styles.paymentLabel}>Adjustment (optional)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter adjustment"
                  className="billing-input"
                  style={styles.paymentInput}
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                />
              </div>
            </div>
            <div style={styles.actionRow}>
              <button style={styles.holdBtn} onClick={handleHoldBill}>
                Hold Bill
              </button>

              <select
                style={styles.resumeSelect}
                onChange={handleResumeBill}
                defaultValue=""
              >
                <option value="" disabled>
                  Resume Bill
                </option>
                {holdBills.map((bill, index) => {
                  const time = new Date(bill.timestamp || Date.now());
                  const timeLabel = time.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const count = bill.items?.length || 0;
                  const name = bill.customer?.name
                    ? ` - ${bill.customer.name}`
                    : "";

                  return (
                    <option key={`${bill.timestamp}-${index}`} value={index}>
                      {timeLabel} - {count} items{name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <button
            style={{
              ...styles.createBtn,
              ...(isCreating ? styles.createBtnDisabled : {}),
            }}
            onClick={handleCreateBill}
            disabled={isCreating}
          >
            {isCreating ? "Processing..." : "Create Bill (Enter)"}
          </button>

          {lastSale && lastInvoice && (
            <button
              style={styles.secondaryBtn}
              onClick={() =>
                navigate("/invoice", { state: { invoice: lastInvoice } })
              }
            >
              Print Invoice
            </button>
          )}

          {lastSale && (
            <button
              style={styles.recordBtn}
              onClick={() => navigate("/collections")}
            >
              Record Payment
            </button>
          )}
        </div>
      </div>

      <div style={styles.stickyBar}>
        <div style={styles.stickyItems}>Items: {itemCount}</div>
        <div style={styles.stickyTotal}>
          PAYABLE {formatCurrency(grandTotal)}
        </div>
      </div>

      {/* INVOICE PREVIEW */}
      {(items.length > 0 || lastInvoice?.items?.length > 0) && (
        <div style={styles.previewBox}>
          {(() => {
            const isDraft = items.length > 0;
            const previewInvoiceNumber = isDraft
              ? `INV-${Date.now()}`
              : lastInvoice?.invoiceNumber;
            const previewCustomer = isDraft ? customer : lastInvoice?.customer;
            const previewItems = isDraft ? items : lastInvoice?.items || [];
            const previewSubtotal = isDraft
              ? total
              : lastInvoice?.subtotal ?? lastInvoice?.total ?? 0;
            const previewDiscount = isDraft
              ? adjustmentValue
              : lastInvoice?.discount ?? 0;
            const previewGrandTotal = isDraft
              ? grandTotal
              : lastInvoice?.grandTotal ??
                Math.max(0, previewSubtotal - previewDiscount);
            const previewPaymentReceived = isDraft
              ? paymentValue
              : lastInvoice?.paymentReceived ?? 0;
            const previewBalance = isDraft
              ? balanceDue
              : lastInvoice?.balanceDue ??
                Math.max(0, previewGrandTotal - previewPaymentReceived);
            const previewPaymentType = isDraft
              ? previewGrandTotal === 0 || previewPaymentReceived >= previewGrandTotal
                ? "PAID"
                : previewPaymentReceived > 0
                  ? "PARTIAL"
                  : "OPEN"
              : lastInvoice?.paymentType || "OPEN";
            const previewDate = isDraft
              ? new Date()
              : lastInvoice?.date || new Date();

            return (
          <InvoicePreview
            invoiceNumber={previewInvoiceNumber}
            customer={previewCustomer}
            items={previewItems}
            subtotal={previewSubtotal}
            discount={previewDiscount}
            grandTotal={previewGrandTotal}
            paymentReceived={previewPaymentReceived}
            balanceDue={previewBalance}
            paymentType={previewPaymentType}
            date={previewDate}
            showPrint={!isDraft && Boolean(lastSale)}
          />
            );
          })()}
        </div>
      )}

      <style>{billingStyles}</style>
    </div>
  );
}

function Billing() {
  return (
    <ErrorBoundary fallback="BILLING ERROR — Refresh Software">
      <BillingContent />
    </ErrorBoundary>
  );
}

const styles = {
  wrapper: {
    width: "100%",
    background: "#f6f7fb",
    padding: 20,
    paddingBottom: 80,
    borderRadius: 12,
  },
  grid: {
    display: "grid",
    gap: 24,
    alignItems: "start",
  },
  leftCol: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  selectedText: {
    marginTop: 10,
    color: "#111",
    fontSize: 13,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 18,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
  },
  cardMuted: {
    background: "#fff",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #eef2f7",
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.05)",
  },
  cardTitle: {
    margin: 0,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: 700,
    color: "#111",
  },
  searchWrap: {
    maxWidth: 520,
    width: "100%",
  },
  tableScroll: {
    maxHeight: "60vh",
    overflowY: "auto",
    border: "1px solid #eef2f7",
    borderRadius: 8,
  },
  cardTitleSmall: {
    margin: 0,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: 600,
    color: "#111",
  },
  fieldBlock: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  detailsGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  fieldInput: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    color: "#111",
    background: "#fff",
  },
  totalCard: {
    background: "#fff",
    borderRadius: 12,
    padding: 18,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e5e7eb",
  },
  totalLabel: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  totalValue: {
    marginTop: 6,
    fontSize: 36,
    fontWeight: 800,
    color: "#111",
  },
  totalBreakdown: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#475569",
  },
  totalRowStrong: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 700,
    color: "#111",
  },
  actionRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  holdBtn: {
    flex: 1,
    minWidth: 120,
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    fontWeight: 600,
  },
  resumeSelect: {
    flex: 1,
    minWidth: 140,
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111",
    fontWeight: 600,
  },
  createBtn: {
    width: "100%",
    height: 52,
    borderRadius: 8,
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  },
  createBtnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
  recordBtn: {
    width: "100%",
    height: 44,
    borderRadius: 8,
    border: "1px solid #111",
    background: "#fff",
    color: "#111",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtn: {
    width: "100%",
    height: 44,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#111",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  previewBox: {
    marginTop: 12,
  },
  toast: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
  },
  toastInfo: {
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  toastSuccess: {
    background: "#ecfdf3",
    color: "#166534",
  },
  toastError: {
    background: "#fef2f2",
    color: "#b91c1c",
  },
  stickyBar: {
    position: "sticky",
    bottom: 0,
    marginTop: 12,
    background: "#111",
    color: "#fff",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 600,
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
  },
  stickyItems: {
    fontSize: 14,
  },
  stickyTotal: {
    fontSize: 20,
  },
  paymentGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
  },
  paymentField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  paymentLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  paymentInput: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    color: "#111",
    background: "#fff",
    fontSize: 14,
  },
};

const billingStyles = `
  .billing-input::placeholder {
    color: #9ca3af;
    opacity: 1;
  }
`;

export default Billing;
