import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard/*" element={<div className="p-8 text-2xl font-bold">Business Dashboard — coming soon</div>} />
        <Route path="/portal/*" element={<div className="p-8 text-2xl font-bold">Customer Portal — coming soon</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App