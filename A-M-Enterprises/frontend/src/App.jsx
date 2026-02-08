import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Reports from "./pages/Reports";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import CustomerLedger from "./pages/CustomerLedger";
import Collections from "./pages/Collections";
import DueReport from "./pages/DueReport";
import Invoice from "./pages/Invoice";
import MainLayout from "./layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* DEFAULT */}
      <Route path="/" element={<Navigate to="/login" />} />

      {/* PUBLIC */}
      <Route path="/login" element={<Login />} />

      {/* PROTECTED */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/products" element={<Products />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerLedger />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/due-recovery" element={<DueReport />} />
          <Route path="/invoice" element={<Invoice />} />
        </Route>
      </Route>
    </Routes>
  );
}


export default App;
