import { createClient } from '@supabase/supabase-js';

const DEFAULT_TG_CONFIG = {
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

function getSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/['"]/g, '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim();
  return (url && key) ? createClient(url, key) : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const envBotToken = 
    process.env.TELEGRAM_BOT_TOKEN_ATTENDANCE ||
    process.env.TELEGRAM_BOT_TOKEN_ATTENDENT ||
    process.env.TELEGRAM_ATTENDANCE_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN_CODE ||
    process.env.BOT_TOKEN || 
    '';
  const supabase = getSupabase();
  let storedConfig = DEFAULT_TG_CONFIG;

  if (supabase) {
    try {
      const { data } = await supabase.from('clean24_collections').select('data').eq('id', 'telegramConfig').maybeSingle();
      if (data && data.data) storedConfig = { ...DEFAULT_TG_CONFIG, ...data.data };
    } catch (e) {}
  }

  const vengSrengToken = (
    process.env.TELEGRAM_BOT_TOKEN_VENG_SRENG ||
    process.env.TELEGRAM_BOT_TOKEN_VENGSRENG ||
    process.env.TELEGRAM_BOT_TOKEN_VS ||
    process.env.TELEGRAM_BOT_TOKEN_B1 ||
    process.env.TELEGRAM_BOT_VENG_SRENG ||
    process.env.BOT_TOKEN_VENG_SRENG ||
    process.env.BOT_TOKEN_B1 ||
    ''
  ).trim();

  const chomkaDoungToken = (
    process.env.TELEGRAM_BOT_TOKEN_CHOMKA_DOUNG ||
    process.env.TELEGRAM_BOT_TOKEN_CHAMKAR_DOUNG ||
    process.env.TELEGRAM_BOT_TOKEN_CHOMKADOUNG ||
    process.env.TELEGRAM_BOT_TOKEN_CHAMKARDOUNG ||
    process.env.TELEGRAM_BOT_TOKEN_CHOMKA ||
    process.env.TELEGRAM_BOT_TOKEN_CHAMKAR ||
    process.env.TELEGRAM_BOT_TOKEN_CD ||
    process.env.TELEGRAM_BOT_TOKEN_B2 ||
    process.env.TELEGRAM_BOT_CHOMKA_DOUNG ||
    process.env.TELEGRAM_BOT_CHAMKAR_DOUNG ||
    process.env.BOT_TOKEN_CHOMKA_DOUNG ||
    process.env.BOT_TOKEN_CHAMKAR_DOUNG ||
    process.env.BOT_TOKEN_B2 ||
    ''
  ).trim();

  const envChatB1 = (
    process.env.TELEGRAM_CHAT_ID_VENG_SRENG ||
    process.env.TELEGRAM_CHAT_ID_VENGSRENG ||
    process.env.TELEGRAM_CHAT_ID_VS ||
    process.env.TELEGRAM_CHAT_ID_B1 ||
    process.env.TELEGRAM_GROUP_ID_VENG_SRENG ||
    process.env.TELEGRAM_GROUP_ID_B1 ||
    process.env.CHAT_ID_VENG_SRENG ||
    process.env.CHAT_ID_B1 ||
    ''
  ).trim();

  const envChatB2 = (
    process.env.TELEGRAM_CHAT_ID_CHOMKA_DOUNG ||
    process.env.TELEGRAM_CHAT_ID_CHAMKAR_DOUNG ||
    process.env.TELEGRAM_CHAT_ID_CHOMKADOUNG ||
    process.env.TELEGRAM_CHAT_ID_CHAMKARDOUNG ||
    process.env.TELEGRAM_CHAT_ID_CD ||
    process.env.TELEGRAM_CHAT_ID_B2 ||
    process.env.TELEGRAM_GROUP_ID_CHOMKA_DOUNG ||
    process.env.TELEGRAM_GROUP_ID_B2 ||
    process.env.CHAT_ID_CHOMKA_DOUNG ||
    process.env.CHAT_ID_B2 ||
    ''
  ).trim();

  if (req.method === 'GET') {
    const effectiveToken = storedConfig.botToken || envBotToken;
    const branches = {
      b1: (storedConfig.chatIds?.branches as any)?.b1 || envChatB1 || '',
      b2: (storedConfig.chatIds?.branches as any)?.b2 || envChatB2 || '',
      ...(storedConfig.chatIds?.branches || {})
    };

    return res.status(200).json({
      success: true,
      ...storedConfig,
      chatIds: {
        ...storedConfig.chatIds,
        branches
      },
      botToken: effectiveToken,
      configured: Boolean(effectiveToken || vengSrengToken || chomkaDoungToken),
      branchBots: {
        b1: { name: 'Veng Sreng', configured: Boolean(vengSrengToken), chatId: branches.b1 },
        b2: { name: 'Chomka Doung', configured: Boolean(chomkaDoungToken), chatId: branches.b2 }
      }
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const updated = { ...storedConfig, ...body, updatedAt: new Date().toISOString() };
    if (supabase) {
      try {
        await supabase.from('clean24_collections').upsert({ id: 'telegramConfig', data: updated, updated_at: new Date().toISOString() });
      } catch (e) {}
    }
    return res.status(200).json({ success: true, config: updated });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}