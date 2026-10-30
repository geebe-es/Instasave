export type Page = 'download' | 'videos' | 'history' | 'settings' | 'updates'

export type Status = {
  type: 'loading' | 'error' | 'success'
  message: string
} | null

export type Media = {
  id: string
  type: 'image' | 'video'
  downloadUrl: string
  previewUrl: string
  videoPreviewUrl?: string
  width?: number
  height?: number
  format?: string
  filename?: string
  duration?: number
}

export type AppInfo = {
  version: string
  productName: string
  downloadFolder: string
}
