import * as FileSystem from 'expo-file-system/legacy';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
}

const LOG_FILE = `${FileSystem.documentDirectory}app.log`;

class LoggerService {
    private async appendToFile(entry: LogEntry) {
        try {
            const line = JSON.stringify(entry) + '\n';
            const info = await FileSystem.getInfoAsync(LOG_FILE);

            if (!info.exists) {
                await FileSystem.writeAsStringAsync(LOG_FILE, line);
            } else {
                // Simple rotation if too large (1MB)
                if (info.size > 1024 * 1024) {
                    await FileSystem.moveAsync({
                        from: LOG_FILE,
                        to: `${FileSystem.documentDirectory}app.log.old`
                    });
                    await FileSystem.writeAsStringAsync(LOG_FILE, line);
                } else {
                    // Read-append-write (inefficient but works for MVP without native modules)
                    const current = await FileSystem.readAsStringAsync(LOG_FILE);
                    await FileSystem.writeAsStringAsync(LOG_FILE, current + line);
                }
            }
        } catch (e) {
            console.error('Failed to write log', e);
        }
    }

    log(level: LogLevel, message: string, data?: any) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };

        // Console
        const consoleMsg = `[${entry.level.toUpperCase()}] ${entry.message}`;
        if (level === 'error') console.error(consoleMsg, data || '');
        else if (level === 'warn') console.warn(consoleMsg, data || '');
        else console.log(consoleMsg, data || '');

        // File
        this.appendToFile(entry);
    }

    info(message: string, data?: any) { this.log('info', message, data); }
    warn(message: string, data?: any) { this.log('warn', message, data); }
    error(message: string, data?: any) { this.log('error', message, data); }
    debug(message: string, data?: any) { this.log('debug', message, data); }

    async getLogs(): Promise<string> {
        try {
            const info = await FileSystem.getInfoAsync(LOG_FILE);
            if (!info.exists) return '';
            return await FileSystem.readAsStringAsync(LOG_FILE);
        } catch {
            return '';
        }
    }

    async clearLogs() {
        try {
            await FileSystem.deleteAsync(LOG_FILE, { idempotent: true });
        } catch { }
    }
}

export const logger = new LoggerService();
