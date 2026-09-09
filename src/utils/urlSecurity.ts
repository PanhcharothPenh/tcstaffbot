/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActiveTab } from '../types';

export const TAB_ROUTE_CODES: Record<ActiveTab, string> = {
  dashboard: 'sec_db7a19',
  branches: 'sec_br3f82',
  staff: 'sec_st9c44',
  shifts: 'sec_sh4c88',
  salary: 'sec_sl2e61',
  telegram_config: 'sec_tg8d35',
  attendance: 'sec_at5b90',
  income: 'sec_in1a77',
  expense: 'sec_ex6f28',
  inventory: 'sec_iv4c13',
  reports: 'sec_rp0e89',
  users: 'sec_us7d56',
  settings: 'sec_st3a42',
  coins: 'sec_cn9f08',
  revenues: 'sec_rv2b71',
  gas: 'sec_gs8e34',
  detergents: 'sec_dt5a96',
  softeners: 'sec_sf1c62',
  stock: 'sec_sk6d27',
  suppliers: 'sec_sp4e18',
  debts: 'sec_db0f83',
  cashdrawer: 'sec_cd7b55',
  monthclosing: 'sec_mc3a41',
  auditlogs: 'sec_al9e04'
};

const REVERSE_CODES: Record<string, ActiveTab> = Object.entries(TAB_ROUTE_CODES).reduce(
  (acc, [tab, code]) => {
    acc[code] = tab as ActiveTab;
    return acc;
  },
  {} as Record<string, ActiveTab>
);

/**
 * Clean readable live URL routing with legacy code support
 */
export function encryptLiveUrl(tab: ActiveTab): string {
  if (!tab || tab === 'dashboard') return '/dashboard';
  return `/${tab}`;
}

/**
 * Decrypt live URL path or fallback to plain tab name
 */
export function decryptLiveUrl(pathOrHash: string): ActiveTab {
  if (!pathOrHash) return 'dashboard';

  const clean = pathOrHash.replace(/^#\/?/, '').replace(/^\/+/, '').split('?')[0].trim().toLowerCase();
  if (!clean || clean === 'login') return 'dashboard';

  // 1. Direct plain tab match (e.g. /dashboard, /users, /branches, /salary, /reports, /settings)
  const plain = clean.split('/')[0];
  if (TAB_ROUTE_CODES[plain as ActiveTab]) {
    return plain as ActiveTab;
  }

  // Telegram alias
  if (plain === 'telegram') return 'telegram_config';

  // 2. Legacy encrypted /v/sec_xxx pattern
  if (clean.startsWith('v/')) {
    const code = clean.replace(/^v\//, '');
    if (REVERSE_CODES[code]) {
      return REVERSE_CODES[code];
    }
  }

  // 3. Direct code match
  if (REVERSE_CODES[clean]) {
    return REVERSE_CODES[clean];
  }

  return 'dashboard';
}
