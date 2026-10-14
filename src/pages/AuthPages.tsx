import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import type { SessionUser } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AuthLayout } from '../components/AuthLayout'
import { OtpInput } from '../components/OtpInput'
import { clearDraft, patchDraft, readDraft } from '../lib/signupDraft'

function tokenUserId(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { id?: string }
    return payload.id || ''
  } catch {
    return ''
  }
}

function messageOf(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/user/auth/login', { method: 'POST', auth: false, body: { email } })
      navigate('/login/verify', { state: { email } })
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="We’ll email you a 4-digit code. No password.">
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        {error ? <div className="error">{error}</div> : null}
        <label className="lbl">Email
          <input className="field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@college.edu" />
        </label>
        <button className="btn btn-dark btn-block" disabled={pending} type="submit">{pending ? 'Sending…' : 'Send code'}</button>
        <p className="muted">New here? <Link to="/signup">Create an account</Link></p>
      </form>
    </AuthLayout>
  )
}

export function LoginCodePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const email = (location.state as { email?: string } | null)?.email || ''
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const result = await api<{ token: string; user: SessionUser }>('/user/auth/verify-login-otp', {
        method: 'POST',
        auth: false,
        body: { email, otp },
      })
      await login(result.user, result.token)
      if (!result.user.isOnboarded) navigate('/verification/status')
      else if (!result.user.eulaAccepted) navigate('/signup/terms')
      else navigate('/')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Enter code" subtitle={email ? `Sent to ${email}` : 'Enter the code from your email.'}>
      <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
        {error ? <div className="error">{error}</div> : null}
        <OtpInput value={otp} onChange={setOtp} invalid={Boolean(error)} />
        <button className="btn btn-dark btn-block" disabled={pending || otp.length < 4} type="submit">Continue</button>
        <button
          className="btn btn-ghost btn-block"
          type="button"
          onClick={() => void api('/user/resend-verification-code', { method: 'POST', auth: false, body: { email } })}
        >Resend code</button>
      </form>
    </AuthLayout>
  )
}

export function CreateAccountPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/user/register-edu', { method: 'POST', auth: false, body: { email } })
      patchDraft({ flow: 'edu', email })
      navigate('/signup/verify')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Create account" subtitle="Use your college email. Other emails go through document verification.">
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        {error ? <div className="error">{error}</div> : null}
        <label className="lbl">College email
          <input className="field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@university.edu" />
        </label>
        <button className="btn btn-dark btn-block" disabled={pending} type="submit">Send code</button>
        <p className="muted">No college email? <Link to="/signup/manual">Verify with documents</Link></p>
        <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </AuthLayout>
  )
}

export function SignUpCodePage() {
  const navigate = useNavigate()
  const draft = readDraft()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const { login } = useAuth()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft?.email) {
      navigate('/signup')
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await api<{ token: string; user?: SessionUser }>('/user/verify-code', {
        method: 'POST',
        auth: false,
        body: { email: draft.email, otp },
      })
      // verify-code only returns a token; the user id is in its payload.
      const user = result.user || {
        id: tokenUserId(result.token),
        email: draft.email,
        isVerified: true,
        isOnboarded: false,
        eulaAccepted: false,
      }
      await login({ ...user, email: draft.email, isVerified: true }, result.token)
      navigate(draft.flow === 'manual' ? '/verification/documents' : '/signup/referral')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Enter code" subtitle={draft?.email ? `Sent to ${draft.email}` : ''}>
      <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
        {error ? <div className="error">{error}</div> : null}
        <OtpInput value={otp} onChange={setOtp} invalid={Boolean(error)} />
        <button className="btn btn-dark btn-block" disabled={pending || otp.length < 4} type="submit">Verify</button>
      </form>
    </AuthLayout>
  )
}

export function ReferralPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState(readDraft()?.referralCode || '')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      if (code.trim()) {
        const result = await api<{ valid: boolean }>('/user/validate-referral-code', {
          method: 'POST',
          auth: false,
          body: { referralCode: code.trim() },
        })
        if (!result.valid) throw new ApiError('That referral code is not valid', 400)
        patchDraft({ referralCode: code.trim() })
      }
      navigate('/signup/details')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Referral code" subtitle="Optional. If a friend invited you, enter their code.">
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        {error ? <div className="error">{error}</div> : null}
        <input className="field" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Referral code" />
        <button className="btn btn-dark btn-block" disabled={pending} type="submit">{code.trim() ? 'Apply and continue' : 'Skip'}</button>
      </form>
    </AuthLayout>
  )
}

export function PersonalInfoPage() {
  const navigate = useNavigate()
  const draft = readDraft()
  const [fullName, setFullName] = useState(draft?.fullName || '')
  const [phoneNumber, setPhoneNumber] = useState(draft?.phoneNumber || '')
  const [university, setUniversity] = useState(draft?.university || '')
  const [universityId, setUniversityId] = useState(draft?.universityId || '')
  const [city, setCity] = useState(draft?.city || '')
  const [suggestions, setSuggestions] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function searchUniversities(query: string) {
    setUniversity(query)
    setUniversityId('')
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    const result = await api<{ universities?: { id: string; name: string }[] }>('/user/universities/search', {
      auth: false,
      query: { query, limit: 8 },
    }).catch(() => ({ universities: [] }))
    setSuggestions(result.universities || [])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft?.email) {
      navigate('/signup')
      return
    }
    setPending(true)
    setError('')
    try {
      await api('/user/complete-edu-onboarding', {
        method: 'POST',
        auth: false,
        body: {
          email: draft.email,
          fullName,
          phoneNumber,
          city,
          university,
          universityId: universityId || undefined,
          referralCode: draft.referralCode,
        },
      })
      patchDraft({ fullName, phoneNumber, university, universityId, city })
      navigate('/signup/terms')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Personal information" subtitle="This is what other students see on your profile.">
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        {error ? <div className="error">{error}</div> : null}
        <label className="lbl">Full name<input className="field" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        <label className="lbl">Phone<input className="field" required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
        <label className="lbl">University
          <input className="field" required value={university} onChange={(event) => void searchUniversities(event.target.value)} />
        </label>
        {suggestions.length > 0 ? (
          <div className="panel">
            {suggestions.map((item) => (
              <button key={item.id} type="button" className="btn btn-ghost" onClick={() => { setUniversity(item.name); setUniversityId(item.id); setSuggestions([]) }}>{item.name}</button>
            ))}
          </div>
        ) : null}
        <label className="lbl">City<input className="field" required value={city} onChange={(event) => setCity(event.target.value)} /></label>
        <button className="btn btn-dark btn-block" disabled={pending} type="submit">Continue</button>
      </form>
    </AuthLayout>
  )
}

export function TermsPage() {
  const navigate = useNavigate()
  const { user, refreshProfile, ensureRealtime } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/user/accept-eula', { method: 'POST', body: { eulaVersion: 'web-1' } })
      if (user) await refreshProfile().catch(() => undefined)
      await ensureRealtime()
      clearDraft()
      navigate('/signup/welcome')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Terms & Conditions" subtitle="Junction is a student-only marketplace. Deals are arranged between students.">
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        {error ? <div className="error">{error}</div> : null}
        <div className="panel" style={{ maxHeight: 220, overflow: 'auto', fontSize: 14, lineHeight: 1.5 }}>
          <p>You agree to list only items you own, meet buyers in safe public places, and keep conversations on Junction until a deal is locked.</p>
          <p>Accounts that are not verified student accounts can be limited until documents are approved.</p>
          <p>The full legal terms also live on the marketing site under Legal.</p>
        </div>
        <label className="checks"><span className="row"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> I agree to the Terms & Conditions</span></label>
        <button className="btn btn-dark btn-block" disabled={!accepted || pending} type="submit">Accept and continue</button>
      </form>
    </AuthLayout>
  )
}

export function WelcomePage() {
  const navigate = useNavigate()
  return (
    <AuthLayout title="Welcome aboard" subtitle="Your account is ready. Start with listings near you.">
      <img className="illo" src="/assets/welcomeboard.png" alt="" />
      <button className="btn btn-dark btn-block" type="button" onClick={() => navigate('/')}>Go to Home</button>
    </AuthLayout>
  )
}

export function ManualInfoPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    phoneNumber: '',
    homeAddress: '',
    university: '',
    enrollmentYear: '',
    graduationYear: '',
    referralCode: '',
  })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await api('/user/register-non-edu', {
        method: 'POST',
        auth: false,
        body: {
          ...form,
          userType: 'student',
          enrollmentYear: form.enrollmentYear ? Number(form.enrollmentYear) : undefined,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        },
      })
      patchDraft({ flow: 'manual', email: form.email, fullName: form.fullName, referralCode: form.referralCode })
      navigate('/signup/manual/verify')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Tell us about you" subtitle="We’ll verify your student status from the documents you upload next.">
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        {error ? <div className="error">{error}</div> : null}
        <input className="field" required type="email" placeholder="Personal email" value={form.email} onChange={(event) => set('email', event.target.value)} />
        <input className="field" required placeholder="Full name" value={form.fullName} onChange={(event) => set('fullName', event.target.value)} />
        <input className="field" required placeholder="Phone" value={form.phoneNumber} onChange={(event) => set('phoneNumber', event.target.value)} />
        <input className="field" required placeholder="University" value={form.university} onChange={(event) => set('university', event.target.value)} />
        <input className="field" required placeholder="Home address" value={form.homeAddress} onChange={(event) => set('homeAddress', event.target.value)} />
        <div className="row">
          <input className="field" placeholder="Enrollment year" value={form.enrollmentYear} onChange={(event) => set('enrollmentYear', event.target.value)} />
          <input className="field" placeholder="Graduation year" value={form.graduationYear} onChange={(event) => set('graduationYear', event.target.value)} />
        </div>
        <input className="field" placeholder="Referral code (optional)" value={form.referralCode} onChange={(event) => set('referralCode', event.target.value)} />
        <button className="btn btn-dark btn-block" disabled={pending} type="submit">Send verification code</button>
      </form>
    </AuthLayout>
  )
}

export function DocumentsPage() {
  const navigate = useNavigate()
  const draft = readDraft()
  const [selfie, setSelfie] = useState<File | null>(null)
  const [collegeId, setCollegeId] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft?.email || !selfie || !collegeId) {
      setError('A selfie and college ID are required.')
      return
    }
    setPending(true)
    setError('')
    try {
      const form = new FormData()
      form.set('email', draft.email)
      if (draft.referralCode) form.set('userReferralCode', draft.referralCode)
      form.set('selfie', selfie)
      form.set('collegeId', collegeId)
      await api('/user/upload-verification-docs', { method: 'POST', form })
      navigate('/verification/status')
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Document verification" subtitle="Upload a selfie and your college ID. Aadhaar is optional.">
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        {error ? <div className="error">{error}</div> : null}
        <label className="file-row">Selfie<input type="file" accept="image/*" onChange={(event) => setSelfie(event.target.files?.[0] || null)} /></label>
        <label className="file-row">College ID<input type="file" accept="image/*" onChange={(event) => setCollegeId(event.target.files?.[0] || null)} /></label>
        <button className="btn btn-dark btn-block" disabled={pending} type="submit">{pending ? 'Uploading…' : 'Submit for review'}</button>
      </form>
    </AuthLayout>
  )
}

export function VerificationStatusPage() {
  const { user, refreshProfile } = useAuth()
  const rejected = user?.userStatus?.toLowerCase().includes('reject')
  return (
    <AuthLayout
      title={rejected ? 'Verification unsuccessful' : 'Verification submitted'}
      subtitle={rejected ? 'Please upload the documents again.' : 'We’ll email you when a reviewer approves your account.'}
    >
      <div className="stack" style={{ gap: 12 }}>
        <img className="illo" src={rejected ? '/assets/verification-unsuccess.png' : '/assets/verificationsubmitted.png'} alt="" />
        <button className="btn btn-ghost btn-block" type="button" onClick={() => void refreshProfile()}>Check status</button>
        {rejected ? <Link className="btn btn-dark btn-block" to="/verification/documents">Re-upload documents</Link> : null}
        {user?.isOnboarded ? <Link className="btn btn-dark btn-block" to="/">Continue to Home</Link> : null}
      </div>
    </AuthLayout>
  )
}
