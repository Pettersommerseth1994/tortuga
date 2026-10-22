import { Route, Routes } from "react-router"

import { Layout } from "./Layout"
import { Checklist } from "./pages/Checklist"
import { MatchPage } from "./pages/MatchPage"
import { Matches } from "./pages/Matches"

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Matches />} />
        <Route path="kamp/:id" element={<MatchPage />} />
        <Route path="sjekkliste" element={<Checklist />} />
        <Route path="*" element={<Matches />} />
      </Route>
    </Routes>
  )
}
