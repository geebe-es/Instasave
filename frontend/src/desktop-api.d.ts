type DownloadStatus = { id?: string; filename?: string; state: 'progress' | 'completed' | 'error'; percent?: number | null; message?: string }
interface Window {
  desktop?: {
    minimize(): Promise<void>; maximize(): Promise<void>; close(): Promise<void>;
    readClipboard(): Promise<string>;
    download(id: string): Promise<void>;
    selectFolder(): Promise<string>; openFolder(id?: string): Promise<void>; openFile(id: string): Promise<string>;
    getInfo(): Promise<{ version: string; productName: string; downloadFolder: string }>;
    authStatus(): Promise<{ connected: boolean }>;
    authLogin(): Promise<{ connected: boolean }>;
    authLogout(): Promise<{ connected: boolean }>;
    behanceResolve(url: string): Promise<{ title: string; media: Array<{ id: string; type: 'image' | 'video'; width?: number; height?: number; format?: string; filename?: string; downloadUrl: string; previewUrl: string }> }>;
    onDownload(callback: (value: DownloadStatus) => void): () => void;
  }
}
