import { useState } from "react";
import api from "../services/api";

function Login() {
  const [email, setEmail] = useState("admin@am.com");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err) {
      alert("Invalid email or password");
    }
  };

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleLogin}>
        <h1 style={styles.title}>A M Enterprises</h1>
        <p style={styles.subtitle}>Owner Login</p>

        <div style={styles.field}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            placeholder="admin@am.com"
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        <button style={styles.button}>Login</button>

        <p style={styles.footer}>
          © {new Date().getFullYear()} A M Enterprises
        </p>
      </form>
    </div>
  );
}
const styles = {
  wrapper: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f4f6f8",
  },

  card: {
    width: 380,
    padding: "35px 32px",
    borderRadius: 12,
    background: "#fff",
    boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
    textAlign: "center",
  },

  title: {
    marginBottom: 4,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 0.5,
  },

  subtitle: {
    marginBottom: 25,
    color: "#666",
    fontSize: 14,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
    marginBottom: 18,
  },

  label: {
    marginBottom: 6,
    fontSize: 13,
    color: "#444",
  },

  input: {
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 14,
    outline: "none",
  },

  button: {
    width: "100%",
    marginTop: 10,
    padding: "11px 0",
    background: "#0f172a",
    fontWeight: 600,
    letterSpacing: 0.3,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 15,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  footer: {
    marginTop: 25,
    fontSize: 12,
    color: "#999",
  },
};

export default Login;
