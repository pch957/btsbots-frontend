import type { ProxySignEnvelope } from '../../types/wallet';

class WebCryptoEnvelopeSigner {
  private keyPair: CryptoKeyPair | null = null;
  private rawPublicKeyHex: string | null = null;
  private dbName = 'btsbots_crypto_store';
  private storeName = 'session_keys';
  private initPromise: Promise<{ isNew: boolean; pubKeyHex: string }> | null = null;

  private _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e: any) => {
        e.target.result.createObjectStore(this.storeName);
      };
      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });
  }

  async initializeOrLoadKey(): Promise<{ isNew: boolean; pubKeyHex: string }> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (this.keyPair && this.rawPublicKeyHex) {
        return { isNew: false, pubKeyHex: this.rawPublicKeyHex };
      }

      const db = await this._openDB();
      return new Promise<{ isNew: boolean; pubKeyHex: string }>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const request = transaction.objectStore(this.storeName).get('active_pair');

        request.onsuccess = async (e: any) => {
          try {
            if (e.target.result) {
              this.keyPair = e.target.result;
              const exportedPubKey = await window.crypto.subtle.exportKey('raw', this.keyPair!.publicKey);
              this.rawPublicKeyHex = Array.from(new Uint8Array(exportedPubKey))
                .map(b => b.toString(16).padStart(2, '0')).join('');
              resolve({ isNew: false, pubKeyHex: this.rawPublicKeyHex });
            } else {
              this.keyPair = await window.crypto.subtle.generateKey(
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['sign', 'verify']
              );

              const exportedPubKey = await window.crypto.subtle.exportKey('raw', this.keyPair.publicKey);
              this.rawPublicKeyHex = Array.from(new Uint8Array(exportedPubKey))
                .map(b => b.toString(16).padStart(2, '0')).join('');

              const writeTx = db.transaction(this.storeName, 'readwrite');
              writeTx.objectStore(this.storeName).put(this.keyPair, 'active_pair');

              resolve({ isNew: true, pubKeyHex: this.rawPublicKeyHex });
            }
          } catch (err) {
            reject(err);
          }
        };
        request.onerror = (e: any) => reject(e.target.error);
      });
    })();

    return this.initPromise;
  }

  async signTransactionIntent(opType: string, opParams: Record<string, any>): Promise<ProxySignEnvelope> {
    if (!this.keyPair) {
      await this.initializeOrLoadKey();
    }
    const rawIntentObject = {
      type: opType,
      client_time: Math.floor(Date.now() / 1000),
      params: opParams
    };

    const txPayloadString = JSON.stringify(rawIntentObject);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(txPayloadString);

    const signatureBuffer = await window.crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      this.keyPair!.privateKey,
      dataBuffer
    );

    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      tx_string: txPayloadString,
      browser_pubkey: this.rawPublicKeyHex!,
      browser_sig: signatureHex
    };
  }
}

export const signerInstance = new WebCryptoEnvelopeSigner();