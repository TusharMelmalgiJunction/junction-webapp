import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './components/AuthLayout'
import {
  AddressesPage,
  BadgesPage,
  FavouritesPage,
  NotificationPrefsPage,
  NotificationsPage,
  NotFoundPage,
  PersonalSettingsPage,
  PrivacyPage,
  ProfilePage,
  PurchasesPage,
  ReferralsPage,
  ReportIssuePage,
  SellerListingPage,
  SoldPage,
  SoldSurveyPage,
  SupportPage,
} from './pages/AccountPages'
import {
  CreateAccountPage,
  DocumentsPage,
  LoginCodePage,
  LoginPage,
  ManualInfoPage,
  PersonalInfoPage,
  ReferralPage,
  SignUpCodePage,
  TermsPage,
  VerificationStatusPage,
  WelcomePage,
} from './pages/AuthPages'
import { ChatsPage } from './pages/ChatPage'
import { HomePage, PublicProfilePage } from './pages/HomePage'
import { ListingPage } from './pages/ListingPage'
import { SearchPage } from './pages/SearchPage'
import { PostCategoryPage, PostDetailsPage, ReviewListingPage, SubmittedPage } from './pages/SellPages'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/verify" element={<LoginCodePage />} />
          <Route path="/signup" element={<CreateAccountPage />} />
          <Route path="/signup/verify" element={<SignUpCodePage />} />
          <Route path="/signup/manual" element={<ManualInfoPage />} />
          <Route path="/signup/manual/verify" element={<SignUpCodePage />} />
          <Route path="/signup/referral" element={<ReferralPage />} />
          <Route path="/signup/details" element={<PersonalInfoPage />} />
          <Route path="/signup/terms" element={<RequireAuth><TermsPage /></RequireAuth>} />
          <Route path="/signup/welcome" element={<RequireAuth><WelcomePage /></RequireAuth>} />
          <Route path="/verification/documents" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
          <Route path="/verification/status" element={<RequireAuth><VerificationStatusPage /></RequireAuth>} />
          <Route path="/u/:userId" element={<PublicProfilePage />} />
          <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
          <Route path="/listing/:id" element={<RequireAuth><ListingPage /></RequireAuth>} />
          <Route path="/chats" element={<RequireAuth><ChatsPage /></RequireAuth>} />
          <Route path="/chats/:chatId" element={<RequireAuth><ChatsPage /></RequireAuth>} />
          <Route path="/sell" element={<RequireAuth><PostCategoryPage /></RequireAuth>} />
          <Route path="/sell/details" element={<RequireAuth><PostDetailsPage /></RequireAuth>} />
          <Route path="/sell/review" element={<RequireAuth><ReviewListingPage /></RequireAuth>} />
          <Route path="/sell/submitted" element={<RequireAuth><SubmittedPage /></RequireAuth>} />
          <Route path="/my-listings/:id" element={<RequireAuth><SellerListingPage /></RequireAuth>} />
          <Route path="/my-listings/:id/sold" element={<RequireAuth><SoldSurveyPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/profile/favourites" element={<RequireAuth><FavouritesPage /></RequireAuth>} />
          <Route path="/profile/purchases" element={<RequireAuth><PurchasesPage /></RequireAuth>} />
          <Route path="/profile/sold" element={<RequireAuth><SoldPage /></RequireAuth>} />
          <Route path="/profile/badges" element={<RequireAuth><BadgesPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/settings/personal" element={<RequireAuth><PersonalSettingsPage /></RequireAuth>} />
          <Route path="/settings/addresses" element={<RequireAuth><AddressesPage /></RequireAuth>} />
          <Route path="/settings/notifications" element={<RequireAuth><NotificationPrefsPage /></RequireAuth>} />
          <Route path="/settings/referrals" element={<RequireAuth><ReferralsPage /></RequireAuth>} />
          <Route path="/settings/privacy" element={<RequireAuth><PrivacyPage /></RequireAuth>} />
          <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
          <Route path="/support/report" element={<RequireAuth><ReportIssuePage /></RequireAuth>} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
