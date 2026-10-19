import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CalculatorPage from './pages/CalculatorPage';
import AdminPage from './pages/AdminPage';

/**
 * App.jsx — Root router
 * /           → CalculatorPage (calculator.html equivalent)
 * /admin      → AdminPage (admin.html equivalent)
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CalculatorPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
