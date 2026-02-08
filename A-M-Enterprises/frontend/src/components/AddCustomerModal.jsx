import { useState } from "react";
import api from "../services/api";

function AddCustomerModal({ onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Customer name is required");
      return;
    }
    if (!shopName.trim()) {
      alert("Shop name is required");
      return;
    }
    if (!phone.trim()) {
      alert("Customer phone is required");
      return;
    }
    if (!address.trim()) {
      alert("Customer address is required");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/customers", {
        name,
        shopName,
        phone,
        address,
      });

      onSuccess(res.data); // return created customer
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to add customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Add New Customer</h3>

        <div style={styles.field}>
          <label>Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label>Shop Name *</label>
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label>Phone *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label>Address *</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancel}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={styles.save}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },

  modal: {
    background: "#fff",
    padding: 20,
    width: 360,
    borderRadius: 12,
    boxShadow: "0 16px 30px rgba(15, 23, 42, 0.18)",
  },

  title: {
    marginBottom: 14,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 12,
    fontSize: 14,
    color: "#6b7280",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },

  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    color: "#111",
    background: "#fff",
  },

  cancel: {
    height: 44,
    background: "#fff",
    border: "1px solid #d1d5db",
    padding: "0 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  save: {
    height: 44,
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    padding: "0 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
};

export default AddCustomerModal;
