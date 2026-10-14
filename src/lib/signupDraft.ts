export type SignupDraft = {
  flow: 'edu' | 'manual'
  email: string
  referralCode?: string
  fullName?: string
  phoneNumber?: string
  university?: string
  universityId?: string
  city?: string
  homeAddress?: string
  enrollmentYear?: string
  graduationYear?: string
}

const KEY = 'junction.signup'

export function readDraft(): SignupDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SignupDraft) : null
  } catch {
    return null
  }
}

export function writeDraft(draft: SignupDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft))
}

export function patchDraft(patch: Partial<SignupDraft>) {
  const current = readDraft() || { flow: 'edu', email: '' }
  writeDraft({ ...current, ...patch })
}

export function clearDraft() {
  sessionStorage.removeItem(KEY)
}
