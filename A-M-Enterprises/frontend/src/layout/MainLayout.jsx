import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

function MainLayout() {
  const location = useLocation();

  // Page title mapping
  const pageConfig = {
    "/dashboard": {
      title: "Dashboard",
      subtitle: "Owner Panel",
    },
    "/billing": {
      title: "Billing",
      subtitle: "Create New Bill",
    },
    "/reports": {
      title: "Reports",
      subtitle: "Sales & Profit Reports",
    },
    "/products": {
      title: "Products",
      subtitle: "Inventory Management",
    },
    "/customers": {
      title: "Customers",
      subtitle: "Customer Directory",
    },
    "/collections": {
      title: "Collections",
      subtitle: "Record Customer Payments",
    },
    "/due-recovery": {
      title: "Due Recovery",
      subtitle: "Outstanding Customer Dues",
    },
    "/invoice": {
      title: "Invoice",
      subtitle: "Printable Receipt",
    },
  };

  const currentPage =
    pageConfig[location.pathname] ||
    (location.pathname.startsWith("/customers/")
      ? { title: "Customer Ledger", subtitle: "Customer Transactions" }
      : pageConfig["/dashboard"]);

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div style={styles.main}>
        {/* Header */}
        <Header
          title={currentPage.title}
          subtitle={currentPage.subtitle}
        />

        {/* Page Content */}
        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    width: "100vw",
    minHeight: "100vh",
    height: "100vh",
    overflow: "hidden",
    background: "#f6f7fb",
    color: "#111",
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  content: {
    flex: 1,
    padding: 28,
    overflowY: "auto",
  },
};

export default MainLayout;
