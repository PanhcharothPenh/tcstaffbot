import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FeatureConfig {
  chatId: string;
  isEnabled: boolean;
}

export interface TelegramConfig {
  botToken: string;
  botUsername?: string;
  enabledAlerts: string[]; // e.g., ['low_stock', 'salary', 'daily_business', 'branch', 'machine']
  chatIds: {
    owner: string;
    admin: string;
    manager: Record<string, string>; // branchId -> chatId
    staff: Record<string, string>;   // branchId -> chatId
    branches: Record<string, string>; // branchId -> chatId
  };
  features?: {
    lowStock?: FeatureConfig;
    machineAlert?: FeatureConfig;
    payrollAlert?: FeatureConfig;
    dailySummary?: FeatureConfig;
  };
}

const CONFIG_PATH = path.join(process.cwd(), 'telegram-config.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'tc_staff_secret_key_32_characters_!!'; // 32 characters
const IV_LENGTH = 16;

const defaultConfig: TelegramConfig = {
  botToken: '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  enabledAlerts: ['low_stock', 'salary', 'daily_business', 'branch', 'machine'],
  chatIds: {
    owner: '',
    admin: '',
    manager: {},
    staff: {},
    branches: {}
  }
};

export function getTelegramConfig(): TelegramConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read telegram config:', e);
  }
  return { ...defaultConfig };
}

/**
 * Resolves Telegram Bot Token from environment variables (supporting TELEGRAM_BOT_TOKEN_ATTENDANCE / ATTENDENT) or config
 */
export function resolveTelegramBotToken(customToken?: string, branchId?: string, branchName?: string): string {
  if (customToken && customToken.trim()) return customToken.trim();
  const bId = (branchId || '').toLowerCase().trim();
  const bName = (branchName || '').toLowerCase().trim();

  // Branch 1: Veng Sreng
  if (bId === 'b1' || bId.includes('vs') || bName.includes('veng') || bName.includes('sreng')) {
    if (process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG) return process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG.trim();
  }

  // Branch 2: Chomka Doung
  if (bId === 'b2' || bId.includes('cd') || bName.includes('chomka') || bName.includes('doung')) {
    if (process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG) return process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG.trim();
  }

  const config = getTelegramConfig();
  return (
    process.env.TELEGRAM_BOT_TOKEN_COFFEE ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
    process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDENT ||
    process.env.TELEGRAM_ATTENDANCE_BOT_TOKEN ||
    config.botToken ||
    ''
  ).trim();
}

export function saveTelegramConfig(config: TelegramConfig): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save telegram config:', e);
  }
}

// Security: AES-256 Token Encryption & Decryption
export function encryptToken(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    // Fallback obfuscation if anything fails
    return Buffer.from(text).toString('base64');
  }
}

export function decryptToken(encryptedText: string): string {
  if (!encryptedText) return '';
  try {
    const textParts = encryptedText.split(':');
    if (textParts.length !== 2) {
      return Buffer.from(encryptedText, 'base64').toString('utf8');
    }
    const iv = Buffer.from(textParts[0], 'hex');
    const encrypted = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    try {
      return Buffer.from(encryptedText, 'base64').toString('utf8');
    } catch {
      return encryptedText;
    }
  }
}

// Token Masking, example: 123456:****abcd
export function maskToken(token: string): string {
  if (!token) return '';
  const parts = token.split(':');
  if (parts.length >= 2) {
    const botId = parts[0];
    const rest = parts.slice(1).join(':');
    const lastFour = rest.length > 4 ? rest.substring(rest.length - 4) : rest;
    return `${botId}:****${lastFour}`;
  }
  if (token.length > 8) {
    return `${token.substring(0, 6)}:****${token.substring(token.length - 4)}`;
  }
  return '****';
}

export interface AlertData {
  shopName: string;
  branchName: string;
  alertType: string;
  dateTime: string;
  details: string;
  actionRequired: string;
}

export function formatTelegramMessage(data: AlertData): string {
  return `<b>🧼 ${data.shopName.toUpperCase()} ALERT SYSTEM</b>
━━━━━━━━━━━━━━━━━
<b>📢 TYPE:</b> <code>${data.alertType}</code>
<b>🏪 BRANCH:</b> <b>${data.branchName}</b>
<b>📅 TIME:</b> <code>${data.dateTime}</code>

<b>📝 DETAILS:</b>
${data.details}

<b>⚠️ REQUIRED ACTION:</b>
<u>${data.actionRequired}</u>
━━━━━━━━━━━━━━━━━`;
}

export async function sendTelegramMessage(
  chatId: string, 
  text: string, 
  parseMode: 'HTML' | 'Markdown' = 'HTML', 
  customBotToken?: string,
  branchId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = customBotToken ? customBotToken.trim() : resolveTelegramBotToken(undefined, branchId);
    
    if (!token) {
      return { success: false, error: 'Telegram Bot Token is not configured' };
    }
    if (!chatId) {
      return { success: false, error: 'Chat ID is missing or empty' };
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      })
    });

    const body = await response.json() as any;
    if (body.ok) {
      return { success: true };
    } else {
      return { success: false, error: body.description || 'Unknown Telegram API Error' };
    }
  } catch (err: any) {
    console.error('Error sending Telegram notification:', err);
    return { success: false, error: err.message || 'Network error sending to Telegram' };
  }
}

export async function getLatestTelegramChatId(customBotToken?: string): Promise<{ success: boolean; chatId?: string; username?: string; firstName?: string; error?: string }> {
  try {
    const token = resolveTelegramBotToken(customBotToken);
    if (!token) {
      return { success: false, error: 'Telegram Bot Token is not configured' };
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10&offset=-10`);
    const data = await response.json() as any;

    if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
      // Find latest message with chat ID
      for (let i = data.result.length - 1; i >= 0; i--) {
        const update = data.result[i];
        const msg = update.message || update.edited_message || update.channel_post;
        if (msg && msg.chat && msg.chat.id) {
          return {
            success: true,
            chatId: String(msg.chat.id),
            username: msg.from?.username || msg.chat.username || '',
            firstName: msg.from?.first_name || msg.chat.first_name || 'User'
          };
        }
      }
    }
    return { success: false, error: 'No recent messages found. Please click START or send a message to your Telegram Bot first!' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to Telegram getUpdates API' };
  }
}

/**
 * Validates Telegram WebApp / Mini App initData cryptographic hash (HMAC-SHA256)
 */
export function validateTelegramInitData(
  initData: string, 
  customBotToken?: string
): { valid: boolean; user?: any; authDate?: number; error?: string } {
  if (!initData) {
    return { valid: false, error: 'initData is empty' };
  }

  const token = resolveTelegramBotToken(customBotToken);
  if (!token) {
    return { valid: false, error: 'Telegram Bot Token is not configured on server' };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      return { valid: false, error: 'hash parameter missing in initData' };
    }

    urlParams.delete('hash');

    // Sort params alphabetically
    const dataCheckArr: string[] = [];
    Array.from(urlParams.keys()).sort().forEach(key => {
      dataCheckArr.push(`${key}=${urlParams.get(key)}`);
    });
    const dataCheckString = dataCheckArr.join('\n');

    // Secret key = HMAC-SHA256(botToken, "WebAppData")
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    
    // Calculated hash = HMAC-SHA256(dataCheckString, secretKey)
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false, error: 'Invalid HMAC signature in initData' };
    }

    const userRaw = urlParams.get('user');
    let user: any = null;
    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch {}
    }

    const authDate = Number(urlParams.get('auth_date') || 0);

    return {
      valid: true,
      user,
      authDate
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Error validating initData' };
  }
}

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula (in meters)
 */
export function calculateHaversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
}

/**
 * Compares two biometric face descriptor vectors and returns a similarity score (0.0 to 1.0)
 */
export function compareFaceVectors(
  refVector: number[] | string, 
  currentVector: number[] | string
): { score: number; match: boolean; threshold: number } {
  const threshold = 0.70; // 70% similarity threshold for face match
  try {
    const v1: number[] = typeof refVector === 'string' ? JSON.parse(refVector) : refVector;
    const v2: number[] = typeof currentVector === 'string' ? JSON.parse(currentVector) : currentVector;

    if (!Array.isArray(v1) || !Array.isArray(v2) || v1.length === 0 || v1.length !== v2.length) {
      return { score: 0, match: false, threshold };
    }

    // Cosine similarity
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      normA += v1[i] * v1[i];
      normB += v2[i] * v2[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return { score: 0, match: false, threshold };
    }

    const cosineSimilarity = dotProduct / (normA * normB);
    // Normalize to 0-1 range
    const normalizedScore = Math.max(0, Math.min(1, Number(cosineSimilarity.toFixed(4))));
    return {
      score: normalizedScore,
      match: normalizedScore >= threshold,
      threshold
    };
  } catch {
    return { score: 0, match: false, threshold };
  }
}


