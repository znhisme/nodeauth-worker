export interface BackupFile {
    filename: string;
    path?: string;
    size?: number;
    lastModified?: string;
    downloadUrl?: string;
}

export interface BackupProvider {
    testConnection(): Promise<boolean>;
    listBackups(): Promise<BackupFile[]>;
    uploadBackup(filename: string, data: string): Promise<void>;
    downloadBackup(path: string): Promise<string>;
    deleteBackup(path: string): Promise<void>;
}
