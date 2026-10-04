import { parseBunkerInput, BunkerSigner, createNostrConnectURI } from 'nostr-tools/nip46';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip04, nip44 } from 'nostr-tools';
import { BunkerNip46Signer } from './signers';

export const REQUIRED_NOSTR_PERMISSIONS: string[] = [
  'get_public_key',
  'sign_event:0',     // Metadata / Profile updates
  'sign_event:5',     // Deletion / Tombstones
  'sign_event:10016', // Watchlistr Follows (NIP-51 follow list)
  'sign_event:27235', // NIP-98 media upload authentication (nostr.build)
  'sign_event:30007', // Watchlistr Block/Mute list (NIP-51 mute list)
  'sign_event:30016', // Watchlistr Lists (NIP-51 curated list)
];

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function parseAnyBunkerInput(input: string): Promise<{ pubkey: string; relays: string[]; secret: string | null } | null> {
  const cleaned = input.trim().replace(/[\r\n\t\s]+/g, '');

  if (cleaned.startsWith('bunker://') || cleaned.startsWith('nostrconnect://')) {
    try {
      const url = new URL(cleaned);
      const pubkey = url.hostname.toLowerCase();
      if (/^[0-9a-f]{64}$/.test(pubkey)) {
        const relays = url.searchParams.getAll('relay');
        const secret = url.searchParams.get('secret');
        return { pubkey, relays, secret };
      }
    } catch (e) { }
  }

  try {
    return await parseBunkerInput(cleaned);
  } catch (e) {
    return null;
  }
}

export async function createBunkerSigner(
  bunkerUrlInput: string,
  existingClientSkHex?: string,
  onAuthCallback?: (authUrl: string) => void
): Promise<BunkerNip46Signer> {
  const cleanedUrl = bunkerUrlInput.trim().replace(/[\r\n\t\s]+/g, '');
  if (!cleanedUrl) {
    throw new Error("Bunker URL cannot be empty.");
  }

  let secretKeyBytes: Uint8Array;
  let secretKeyHex: string;

  if (existingClientSkHex && existingClientSkHex.length === 64) {
    secretKeyHex = existingClientSkHex;
    secretKeyBytes = hexToBytes(existingClientSkHex);
  } else {
    secretKeyBytes = generateSecretKey();
    secretKeyHex = bytesToHex(secretKeyBytes);
  }

  const bunkerParams: any = {
    onauth: (authUrl: string) => {
      console.log("NIP-46 Auth Challenge received:", authUrl);
      if (onAuthCallback) {
        onAuthCallback(authUrl);
      } else if (typeof window !== 'undefined') {
        if (authUrl.startsWith('http://') || authUrl.startsWith('https://')) {
          window.open(authUrl, '_blank', 'width=600,height=700');
        }
      }
    }
  };

  const bunkerPointer = await parseAnyBunkerInput(cleanedUrl);
  if (!bunkerPointer || !bunkerPointer.pubkey) {
    throw new Error("Invalid bunker:// or nostrconnect:// URL or NIP-05 format.");
  }
  if (!bunkerPointer.relays || bunkerPointer.relays.length === 0) {
    throw new Error("No relays specified in bunker URL. Please include at least one ?relay=wss://...");
  }

  const bunkerSigner = BunkerSigner.fromBunker(secretKeyBytes, bunkerPointer, bunkerParams);

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://watchlistr.app';
  const clientMetadata = { name: 'Watchlistr', url: appOrigin };

  // Send connect request with strict 10s timeout, requesting unified permissions
  try {
    const permsString = REQUIRED_NOSTR_PERMISSIONS.join(',');
    const connectPromise = (bunkerSigner as any).sendRequest('connect', [
      bunkerPointer.pubkey,
      bunkerPointer.secret || '',
      permsString,
      JSON.stringify(clientMetadata)
    ]);
    await Promise.race([
      connectPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connect request timed out after 10s. Please check if your remote signer app (e.g. Amber) is open.")), 10000)
      )
    ]);
  } catch (e: any) {
    const errStr = typeof e === 'string' ? e : (e?.message || JSON.stringify(e));
    console.warn("bunkerSigner.connect warning/error:", errStr);
    if (errStr.includes("no permission")) {
      throw new Error("Amber returned 'no permission'. Please open the Amber app on your Android phone, check for a connection prompt or App Permissions list, and tap 'Allow' for Watchlistr.");
    }
  }

  // Retrieve public key with strict 10s timeout
  let pubkey = '';
  try {
    const getPkPromise = bunkerSigner.getPublicKey();
    pubkey = await Promise.race([
      getPkPromise,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Timed out waiting for public key from Remote Signer (10s).")), 10000)
      )
    ]);
  } catch (err: any) {
    const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
    if (errStr.includes("no permission")) {
      throw new Error("Amber returned 'no permission' for get_public_key. Please open Amber on your phone and grant permission for Watchlistr.");
    }
    throw err;
  }

  if (!pubkey) {
    throw new Error("Failed to retrieve public key from Remote Signer.");
  }

  return new BunkerNip46Signer(bunkerSigner, secretKeyHex, cleanedUrl, pubkey);
}

export interface NostrConnectSession {
  uri: string;
  clientSecretKeyHex: string;
  listen: () => Promise<BunkerNip46Signer>;
}

export function startNostrConnectSession(
  relays: string[] = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://purplepag.es'],
  onAuthCallback?: (authUrl: string) => void
): NostrConnectSession {
  const clientSecretKey = generateSecretKey();
  const clientSecretKeyHex = bytesToHex(clientSecretKey);
  const clientPubkey = getPublicKey(clientSecretKey);
  const secretBytes = generateSecretKey().subarray(0, 16);
  const secretHex = bytesToHex(secretBytes);

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://watchlistr.app';

  const rawUri = createNostrConnectURI({
    clientPubkey,
    relays,
    secret: secretHex,
    name: 'Watchlistr',
    url: appOrigin,
    perms: REQUIRED_NOSTR_PERMISSIONS
  });

  const uri = rawUri
    .replace(/relay=wss%3A%2F%2F/g, 'relay=wss://')
    .replace(/relay=ws%3A%2F%2F/g, 'relay=ws://');

  const bunkerParams: any = {
    onauth: (authUrl: string) => {
      console.log("NIP-46 Auth Challenge received:", authUrl);
      if (onAuthCallback) {
        onAuthCallback(authUrl);
      } else if (typeof window !== 'undefined') {
        if (authUrl.startsWith('http://') || authUrl.startsWith('https://')) {
          window.open(authUrl, '_blank', 'width=600,height=700');
        }
      }
    }
  };

  const listen = async (): Promise<BunkerNip46Signer> => {
    return new Promise<BunkerNip46Signer>((resolve, reject) => {
      let isSettled = false;
      const signer = new (BunkerSigner as any)(clientSecretKey, bunkerParams);

      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try { sub.close(); } catch (_e) { }
          reject(new Error("Nostr Connect session timed out after 2 minutes. Please check your signer app."));
        }
      }, 120000);

      // Subscribe to NostrConnect response events (#p: clientPubkey)
      const sub = signer.pool.subscribe(
        relays,
        {
          kinds: [24133],
          "#p": [clientPubkey],
          limit: 0
        },
        {
          onevent: async (event: any) => {
            if (isSettled) return;
            try {
              let response: any = null;
              // 1. Try NIP-04 decryption (used by Clave and traditional iOS signers)
              try {
                const decrypted04 = nip04.decrypt(clientSecretKey, event.pubkey, event.content);
                response = JSON.parse(decrypted04);
              } catch (_e) {
                // 2. Try NIP-44 decryption fallback (used by Amber and newer NIP-46 signers)
                try {
                  const convKey = nip44.getConversationKey(clientSecretKey, event.pubkey);
                  const decrypted44 = nip44.decrypt(event.content, convKey);
                  response = JSON.parse(decrypted44);
                } catch (_err) { }
              }

              if (!response) return;

              console.log("NIP-46 response received:", response, "from pubkey:", event.pubkey);

              // Handle onauth challenge URL
              if (response.result === 'auth_url' || response.error?.startsWith('http://') || response.error?.startsWith('https://')) {
                const authUrl = response.error || response.result;
                if (bunkerParams.onauth) {
                  bunkerParams.onauth(authUrl);
                }
              }

              // Accept response if result === secret OR result === 'ack' OR id === secret OR result is truthy without error
              const isMatch = response.result === secretHex ||
                response.result === 'ack' ||
                response.id === secretHex ||
                (response.result && response.result !== 'auth_url' && !response.error);

              if (isMatch) {
                isSettled = true;
                clearTimeout(timeoutId);
                try { sub.close(); } catch (_e) { }

                signer.bp = {
                  pubkey: event.pubkey,
                  relays,
                  secret: secretHex
                };

                try {
                  signer.conversationKey = nip44.getConversationKey(clientSecretKey, event.pubkey);
                } catch (_e) { }

                signer.setupSubscription();

                if (!bunkerParams.skipSwitchRelays) {
                  await Promise.race([
                    new Promise(r => setTimeout(r, 1000)),
                    signer.switchRelays()
                  ]);
                }

                // Fetch public key with 10s timeout, fallback to event.pubkey if needed
                let pubkey = '';
                try {
                  pubkey = await Promise.race([
                    signer.getPublicKey(),
                    new Promise<string>((_, rej) => setTimeout(() => rej(new Error("Timed out fetching public key from remote signer (10s).")), 10000))
                  ]);
                } catch (err: any) {
                  console.warn("Failed getPublicKey during connect, falling back to signer event pubkey:", err);
                  pubkey = event.pubkey;
                }

                const bunkerUrl = `bunker://${signer.bp.pubkey}?${signer.bp.relays.map((r: string) => `relay=${encodeURIComponent(r)}`).join('&')}&secret=${signer.bp.secret || ''}`;

                resolve(new BunkerNip46Signer(signer, clientSecretKeyHex, bunkerUrl, pubkey));
              }
            } catch (e) {
              console.warn("Failed to process potential Nostr Connect event:", e);
            }
          },
          onclose: () => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeoutId);
              reject(new Error("Relay subscription closed before Nostr Connect session was established."));
            }
          }
        }
      );
    });
  };

  return { uri, clientSecretKeyHex, listen };
}
