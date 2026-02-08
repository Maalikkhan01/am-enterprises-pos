import { useNavigate } from "react-router-dom";

function Header({ title = "Dashboard", subtitle = "Owner Panel" }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <header style={styles.header}>
      {/* Left Title */}
      <div>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      {/* Right Actions */}
      <div style={styles.right}>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    height: 72,
    padding: "0 28px",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #e5e7eb",
  },

  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#111",
  },

  subtitle: {
    margin: 0,
    fontSize: 13,
    color: "#6b7280",
  },

  right: {
    display: "flex",
    alignItems: "center",
  },

  logoutBtn: {
    height: 44,
    padding: "0 16px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};

export default Header;
