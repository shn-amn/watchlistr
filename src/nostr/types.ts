export interface NostrEvent {
  id?: string;
  pubkey?: string;
  sig?: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface NostrSigner {
  type: 'extension' | 'bunker' | 'readonly';
  getPublicKey(): Promise<string>;
  signEvent(unsignedEvent: any): Promise<NostrEvent>;
}
