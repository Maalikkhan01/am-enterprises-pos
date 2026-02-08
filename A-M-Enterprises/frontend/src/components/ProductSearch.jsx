import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";
import useDebouncedSearch from "../hooks/useDebouncedSearch";

function ProductSearch({
  items,
  onAdd,
  inputRef,
  onProductAdded,
  onEmptyEnter,
  clearSignal,
}) {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const localRef = useRef(null);
  const searchRef = inputRef || localRef;
  const searchProducts = useCallback(async (term, signal) => {
    const res = await api.get(
      `/products/search?q=${encodeURIComponent(term)}`,
      { signal }
    );
    return res.data || [];
  }, []);

  const { results: suggestions, loading } = useDebouncedSearch({
    query,
    searchFn: searchProducts,
    delay: 300,
    minLength: 1,
  });

  // ✅ AUTO FOCUS (VERY IMPORTANT FOR POS)
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setQuery("");
    setActiveIndex(0);
    searchRef.current?.focus();
  }, [clearSignal]);

  useEffect(() => {
    if (!query.trim()) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex(0);
  }, [query]);

  // ✅ ADD PRODUCT TO BILL
  const addProduct = (p) => {
    const stock = Number(p.stock);
    const minAlert = Number(p.minStockAlert);

    if (Number.isFinite(stock) && stock <= 0) {
      alert("Out of stock");
      searchRef.current?.focus();
      return;
    }

    if (
      Number.isFinite(stock) &&
      Number.isFinite(minAlert) &&
      stock <= minAlert
    ) {
      alert(`Only ${stock} left in stock`);
    }

    const price = Number(p.sellingPrice) || 0;

    if (!price) {
      alert("Product price missing");
      return;
    }

    const existing = items.find((i) => i._id === p._id);

    if (existing) {
      onAdd(
        items.map((i) =>
          i._id === p._id ? { ...i, qty: i.qty + 1 } : i
        )
      );
    } else {
      onAdd([
        ...items,
        {
          _id: p._id,
          name: p.name,
          price,
          qty: 1,
        },
      ]);
    }

    // 🔥 RESET SEARCH
    setQuery("");
    setActiveIndex(0);

    onProductAdded?.(p._id);
    if (!onProductAdded) {
      // 🔥 REFOCUS (INSANE UX BOOST)
      searchRef.current?.focus();
    }
  };

  // ✅ ENTER = ADD FIRST RESULT
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) =>
        Math.min(prev + 1, suggestions.length - 1)
      );
      return;
    }

    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      if (suggestions.length > 0) {
        e.preventDefault();
        const selected =
          suggestions[activeIndex] || suggestions[0];
        if (selected) addProduct(selected);
        return;
      }

      if (!query.trim()) {
        e.preventDefault();
        onEmptyEnter?.();
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setActiveIndex(0);
    }
  };

  return (
    <div style={styles.wrapper}>
      <input
        ref={searchRef}
        type="text"
        placeholder="Search product by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        style={styles.input}
      />

      {loading && <div style={styles.info}>Searching...</div>}

      {!loading && suggestions.length > 0 && (
        <ul style={styles.list}>
          {suggestions.map((p, index) => {
            const stockValue = Number(p.stock);
            const stockLabel = Number.isFinite(stockValue)
              ? stockValue
              : "N/A";
            const price = Number(p.sellingPrice) || 0;

            return (
            <li
              key={p._id}
              style={{
                ...styles.item,
                ...(index === activeIndex ? styles.itemActive : {}),
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => addProduct(p)}
            >
              <div style={styles.itemText}>
                <span style={styles.itemName}>{p.name}</span>
                <span style={styles.itemMeta}>
                  {" "}
                  - {formatCurrency(price)} - Stock: {stockLabel}
                </span>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      {!loading && query.trim() && suggestions.length === 0 && (
        <div style={styles.info}>No products found. Try another name.</div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    width: "100%",
  },

  input: {
    width: "100%",
    height: 48,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 15,
    background: "#fff",
    color: "#111",
    outline: "none",
  },

  list: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    maxHeight: 240,
    overflowY: "auto",
    listStyle: "none",
    padding: 0,
    margin: 0,
    zIndex: 10,
    boxShadow: "0 10px 18px rgba(15, 23, 42, 0.08)",
  },

  item: {
    padding: "12px 14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    fontSize: 14,
    color: "#111",
    borderBottom: "1px solid #f1f5f9",
  },

  itemActive: {
    background: "#f1f5f9",
  },

  itemText: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },

  itemName: {
    fontWeight: 700,
  },

  itemMeta: {
    fontSize: 13,
    color: "#4b5563",
  },

  info: {
    marginTop: 6,
    fontSize: 13,
    color: "#6b7280",
  },
};

export default ProductSearch;
