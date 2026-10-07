import { BunkerSigner } from 'nostr-tools/nip46';
import type { NostrEvent, NostrSigner } from './types';

export class Nip07Signer implements NostrSigner {
  type: 'extension' = 'extension';

  async getPublicKey(): Promise<string> {
    if (!window.nostr) throw new Error("No NIP-07 extension found.");
    return await window.nostr.getPublicKey();
  }

  async signEvent(unsignedEvent: any): Promise<NostrEvent> {
    if (!window.nostr) throw new Error("No NIP-07 extension found.");
    return await window.nostr.signEvent(unsignedEvent);
  }
}

export class ReadOnlySigner implements NostrSigner {
  type: 'readonly' = 'readonly';
  private pubkey: string;

  constructor(pubkey: string) {
    this.pubkey = pubkey;
  }

  async getPublicKey(): Promise<string> {
    return this.pubkey;
  }

  async signEvent(_unsignedEvent: any): Promise<NostrEvent> {
    throw new Error("Cannot sign events in Read-Only mode.");
  }
}

export class BunkerTimeoutError extends Error {
  constructor(message = "Remote signer request timed out after 15s. Connection may be broken.") {
    super(message);
    this.name = "BunkerTimeoutError";
  }
}

export class BunkerNip46Signer implements NostrSigner {
  type: 'bunker' = 'bunker';
  private bunkerSigner: BunkerSigner;
  public clientSecretKeyHex: string;
  public bunkerUrl: string;
  public cachedPubkey?: string;

  constructor(bunkerSigner: BunkerSigner, clientSecretKeyHex: string, bunkerUrl: string, pubkey?: string) {
    this.bunkerSigner = bunkerSigner;
    this.clientSecretKeyHex = clientSecretKeyHex;
    this.bunkerUrl = bunkerUrl;
    this.cachedPubkey = pubkey;
  }

  async getPublicKey(): Promise<string> {
    if (this.cachedPubkey) return this.cachedPubkey;
    const pk = await this.bunkerSigner.getPublicKey();
    this.cachedPubkey = pk;
    return pk;
  }

  async signEvent(unsignedEvent: any, timeoutMs = 15000): Promise<NostrEvent> {
    return await Promise.race([
      this.bunkerSigner.signEvent(unsignedEvent),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new BunkerTimeoutError(`Remote signer request timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);
      })
    ]);
  }

  async close(): Promise<void> {
    try {
      await this.bunkerSigner.close();
    } catch (e) { }
  }
}
