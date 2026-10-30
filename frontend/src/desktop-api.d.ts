type DownloadStatus = { id?: string; filename?: string; state: 'progress' | 'completed' | 'error'; percent?: number | null; message?: string }
interface Window {
  desktop?: {
    minimize(): Promise<void>; maximize(): Promise<void>; close(): Promise<void>;
    readClipboard(): Promise<string>;
    download(id: string): Promise<void>;
    selectFolder(): Promise<string>; openFolder(id?: string): Promise<void>; openFile(id: string): Promise<string>;
    getInfo(): Promise<{ version: string; productName: string; downloadFolder: string }>;
    onDownload(callback: (value: DownloadStatus) => void): () => void;
  }
}
