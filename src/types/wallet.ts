import type { BalanceDoc, TransferDoc } from './models';

export interface PaymentIntentParams {
  to_account: string;
  asset: string;
  amount: number;
  memo?: string;
}

export interface ProxySignEnvelope {
  tx_string: string;
  browser_pubkey: string;
  browser_sig: string;
}

export interface ProxySignRequestResponse {
  success: boolean;
  txId?: string;
  requirePin?: boolean;
  message?: string;
}

export interface OAuthChallengeData {
  site: string;
  ip: string;
  clientId: string;
  token: string;
  redirect?: string | null;
}

export interface EnrichedBalance extends BalanceDoc {
  rating: number;
  isForcedVisible: boolean;
  isManuallyHidden: boolean;
  worthCNY?: number;
}

export interface EnrichedTransfer extends TransferDoc {
  isOut: boolean;
  counterparty: string;
  plainGoods?: string | null;
  plainMemo?: string | null;
}