import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppProvider, useApp } from "@/contexts/AppContext"
import AppShell from "@/components/layout/AppShell"
import OfflineSyncManager from "@/components/checkin/OfflineSyncManager"
import PwaUpdateBanner from "@/components/PwaUpdateBanner"
import LoginPage from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import EventsPage from "@/pages/EventsPage"
import EventFormPage from "@/pages/EventFormPage"
import EventDetailPage from "@/pages/EventDetailPage"
import MailingPage from "@/pages/MailingPage"
import ContactsPage from "@/pages/ContactsPage"
import ContactDetailPage from "@/pages/ContactDetailPage"
import NewContactPage from "@/pages/NewContactPage"
import ImportContactsPage from "@/pages/ImportContactsPage"
import OrganizationsPage from "@/pages/OrganizationsPage"
import NewOrganizationPage from "@/pages/NewOrganizationPage"
import ImportOrganizationsPage from "@/pages/ImportOrganizationsPage"
import OrganizationDetailPage from "@/pages/OrganizationDetailPage"
import SegmentationsPage from "@/pages/SegmentationsPageWithIcons"
import ReportsPage from "@/pages/ReportsPage"
import SettingsPage from "@/pages/SettingsPage"

function AppRoutes() {
  const { state } = useApp()
  const user = state.user

  // A revalidação de sessão do Supabase pode marcar a autenticação como
  // "carregando" quando a aba recupera foco. Se já existe um usuário válido,
  // mantemos a aplicação visível e deixamos a sincronização ocorrer ao fundo.
  if (state.isAuthLoading && !user) {
    return (
      <div className="min-h-full flex items-center justify-center bg-neutral">
        <div className="flex items-center gap-3 text-carbon-60 text-sm font-semibold">
          <span className="w-5 h-5 rounded-full border-2 border-carbon-20 border-t-green animate-spin" />
          Carregando plataforma…
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={user ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route index element={<DashboardPage />} />
        <Route path="eventos" element={<EventsPage />} />
        <Route path="eventos/novo" element={<EventFormPage />} />
        <Route path="eventos/:id/editar" element={<EventFormPage />} />
        <Route path="eventos/:id" element={<EventDetailPage />} />
        <Route path="mailing" element={<MailingPage />} />
        <Route path="contatos" element={<ContactsPage />} />
        <Route path="contatos/novo" element={<NewContactPage />} />
        <Route path="contatos/importar" element={<ImportContactsPage />} />
        <Route path="contatos/:id" element={<ContactDetailPage />} />
        <Route path="organizacoes" element={<OrganizationsPage />} />
        <Route path="organizacoes/nova" element={<NewOrganizationPage />} />
        <Route path="organizacoes/importar" element={<ImportOrganizationsPage />} />
        <Route path="organizacoes/:id" element={<OrganizationDetailPage />} />
        <Route path="segmentacoes" element={<SegmentationsPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="configuracoes" element={<Navigate to="/configuracoes/perfil" replace />} />
        <Route path="configuracoes/:section" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <OfflineSyncManager />
      <BrowserRouter>
        <AppRoutes />
        <PwaUpdateBanner />
      </BrowserRouter>
    </AppProvider>
  )
}
