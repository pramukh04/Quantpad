import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BacktestAnalyzer from './pages/BacktestAnalyzer'
import SignalTester from './pages/SignalTester'
import PineGenerator from './pages/PineGenerator'
import FactorAnalyzer from './pages/FactorAnalyzer'
import PropSimulator from './pages/PropSimulator'
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
          <Route path="/factors" element={<FactorAnalyzer />} />
          <Route path="/prop-sim" element={<PropSimulator />} />
          <Route path="/strategies" element={<StrategyLibrary />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
