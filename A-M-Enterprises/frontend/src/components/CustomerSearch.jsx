import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";
import AddCustomerModal from "./AddCustomerModal";
import useDebouncedSearch from "../hooks/useDebouncedSearch";

function CustomerSearch({ onSelect, inputRef }) {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount) || 0);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const localRef = useRef(null);
  const searchRef = inputRef || localRef;
  const searchCustomers = useCallback(async (term, signal) => {
    const res = await api.get(
      `/customers/search?q=${encodeURIComponent(term)}&includeDetails=1`,
      { signal }
    );
    return res.data || [];
  }, []);

  const { results: suggestions, loading } = useDebouncedSearch({
    query,
    searchFn: searchCustomers,
    delay: 300,
    minLength: 1,
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length]);

  const handleSelect = (c) => {
    onSelect(c);
    setQuery("");
    setActiveIndex(0);
  };

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

    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      const selected = suggestions[activeIndex] || suggestions[0];
      if (selected) handleSelect(selected);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setActiveIndex(0);
    }
  };

  return (
    <div style={{ position: "relative", maxWidth: 420 }}>
      <div style={styles.row}>
        <input
          ref={searchRef}
          placeholder="Search customer"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />

        <button
          style={styles.addBtn}
          onClick={() => setShowModal(true)}
        >
          + Add
        </button>
      </div>

      {loading && <div style={styles.info}>Searching...</div>}

      {!loading && suggestions.length > 0 && (
        <ul style={styles.list}>
          {suggestions.map((c, index) => (
            <li
              key={c._id}
              onClick={() => handleSelect(c)}
              onMouseEnter={() => setActiveIndex(index)}
              style={{
                ...styles.item,
                ...(index === activeIndex ? styles.itemActive : {}),
              }}
            >
              <div style={styles.itemText}>
                <span style={styles.itemName}>{c.name}</span>
                <span style={styles.itemMeta}>
                  {" "}
                  - {c.phone || "No phone"} - Due{" "}
                  {formatCurrency(c.dueAmount || 0)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && query.trim() && suggestions.length === 0 && (
        <div style={styles.info}>No customers found.</div>
      )}

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onSuccess={(newCustomer) => {
            onSelect(newCustomer);
            setQuery("");
            setActiveIndex(0);
          }}
        />
      )}
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  input: {
    flex: 1,
    height: 48,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "#fff",
    color: "#111",
  },

  addBtn: {
    height: 48,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },

  list: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    listStyle: "none",
    margin: 0,
    padding: 0,
    zIndex: 10,
    boxShadow: "0 10px 18px rgba(15, 23, 42, 0.08)",
  },

  item: {
    padding: "12px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
    color: "#111",
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

export default CustomerSearch;
