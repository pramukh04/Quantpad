import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BacktestAnalyzer from './pages/BacktestAnalyzer'
import SignalTester from './pages/SignalTester'
import PineGenerator from './pages/PineGenerator'
import StrategyLibrary from './pages/StrategyLibrary'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/backtest" element={<BacktestAnalyzer />} />
          <Route path="/signals" element={<SignalTester />} />
          <Route path="/pine" element={<PineGenerator />} />
          <Route path="/strategies" element={<StrategyLibrary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
