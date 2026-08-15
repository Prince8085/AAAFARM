import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './store/AppStore'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { NewBill } from './pages/NewBill'
import { BillsList } from './pages/BillsList'
import { BillView } from './pages/BillView'
import { Customers } from './pages/Customers'
import { CustomerDetail } from './pages/CustomerDetail'
import { Parties } from './pages/Parties'
import { PartyDetail } from './pages/PartyDetail'
import { TripForm } from './pages/TripForm'
import { PartyBill } from './pages/PartyBill'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bills/new" element={<NewBill />} />
            <Route path="/bills" element={<BillsList />} />
            <Route path="/bills/:id" element={<BillView />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/parties/:id" element={<PartyDetail />} />
            <Route path="/parties/:partyId/trip/new" element={<TripForm />} />
            <Route path="/parties/:partyId/trip/:tripId" element={<TripForm />} />
            <Route path="/parties/:partyId/bill/:tripIds" element={<PartyBill />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
