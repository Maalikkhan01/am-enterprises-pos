import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <div style={styles.sidebar}>
      {/* Brand */}
      <div style={styles.brand}>
        A&nbsp;M&nbsp;Enterprises
      </div>

      {/* Menu */}
      <nav style={styles.menu}>
        <NavLink
          to="/dashboard"
          style={({ isActive }) =>
            isActive
              ? { ...styles.link, ...styles.active }
              : styles.link
          }
        >
          Dashboard
        </NavLink>

        <NavLink
          to="/billing"
          style={({ isActive }) =>
            isActive
              ? { ...styles.link, ...styles.active }
              : styles.link
          }
        >
          Billing
        </NavLink>

        <NavLink
          to="/reports"
          style={({ isActive }) =>
            isActive
              ? { ...styles.link, ...styles.active }
              : styles.link
          }
        >
          Reports
        </NavLink>

        <NavLink
          to="/products"
          style={({ isActive }) =>
            isActive
              ? { ...styles.link, ...styles.active }
              : styles.link
          }
        >
          Products
        </NavLink>

        <NavLink
          to="/customers"
          style={({ isActive }) =>
            isActive
              ? { ...styles.link, ...styles.active }
              : styles.link
          }
        >
          Customers
        </NavLink>

        <NavLink
          to="/collections"
          style={({ isActive }) =>
            isActive
              ? { ...styles.link, ...styles.active }
              : styles.link
          }
        >
          Collections
        </NavLink>

        <NavLink
          to="/due-recovery"
          style={({ isActive }) =>
            isActive
              ? { ...styles.link, ...styles.active }
              : styles.link
          }
        >
          Due Recovery
        </NavLink>
      </nav>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 240,
    minHeight: "100vh",
    flexShrink: 0,
    background: "#0f1115",
    color: "#fff",
    padding: "24px 18px",
    boxSizing: "border-box",
  },

  brand: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 26,
    textAlign: "left",
    letterSpacing: 0.4,
    color: "#f8fafc",
  },

  menu: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  link: {
    padding: "12px 14px",
    borderRadius: 10,
    color: "#cbd5e1",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 500,
  },

  active: {
    background: "#1f2937",
    color: "#fff",
    fontWeight: 600,
  },
};

export default Sidebar;
