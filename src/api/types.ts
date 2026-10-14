export type SessionUser = {
  id: string
  email: string
  fullName?: string | null
  isOnboarded?: boolean
  isVerified?: boolean
  userStatus?: string
  userType?: string
  eulaAccepted?: boolean
  selfieUrl?: string | null
  phoneNumber?: string | null
  university?: string | null
  homeAddress?: string | null
  referralCode?: string | null
  username?: string | null
}

export type Seller = {
  id: string
  fullName?: string | null
  email?: string | null
  selfieUrl?: string | null
  university?: string | null
}

export type Product = {
  id: string
  name?: string
  title?: string
  description?: string
  category?: string
  subCategory?: string | null
  condition?: string
  brand?: string
  yearOfPurchase?: number
  usage?: string
  price?: number | null
  status?: string
  isAuction?: boolean
  images?: unknown
  location?: unknown
  readableLocation?: string | null
  sellerId?: string
  seller?: Seller | null
  createdAt?: string
  distance?: number | null
  currentOrderId?: string | null
  buyerId?: string | null
}

export type ChatParty = {
  id: string
  fullName?: string | null
  selfieUrl?: string | null
  university?: string | null
}

export type RestMessage = {
  senderId: string
  message?: string
  timestamp?: string
  files?: { fileUrl?: string; filename?: string }[]
}

export type RestChat = {
  id: string
  sellerId: string
  buyerId: string
  product?: Product | null
  messages?: RestMessage[]
  createdAt?: string
  updatedAt?: string
  buyer?: ChatParty | null
  seller?: ChatParty | null
}

export type Address = {
  id: string
  label?: string
  address?: string
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
}

export type AppNotification = {
  id: string
  title?: string
  message?: string
  imageUrl?: string | null
  createdAt?: string
}
