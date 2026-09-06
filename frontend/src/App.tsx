import { Routes, Route } from 'react-router'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PrList from './pages/PrList'
import PrDetail from './pages/PrDetail'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/repos/:repoId/prs" element={<PrList />} />
      <Route path="/repos/:repoId/prs/:prNumber" element={<PrDetail />} />
    </Routes>
  )
}

export default App
