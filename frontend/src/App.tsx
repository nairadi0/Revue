import { Routes, Route } from 'react-router'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PrList from './pages/PrList'
import PrDetail from './pages/PrDetail'
import Metrics from './pages/Metrics'
import AgentRuns from './pages/AgentRuns'
import AgentRunDetail from './pages/AgentRunDetail'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/repos/:repoId/prs" element={<PrList />} />
      <Route path="/repos/:repoId/prs/:prNumber" element={<PrDetail />} />
      <Route path="/metrics" element={<Metrics />} />
      <Route path="/runs" element={<AgentRuns />} />
      <Route path="/runs/:runId" element={<AgentRunDetail />} />
    </Routes>
  )
}

export default App
