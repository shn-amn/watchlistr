import type { NostrSigner } from './types';

/**
 * NIP-98 Authenticated Media Upload to nostr.build / void.cat
 * Signs a kind:27235 HTTP Auth event with the user's Nostr key, attributing image ownership to the user's npub.
 */
export async function uploadNostrImage(
  file: File,
  signer: NostrSigner
): Promise<string> {
  const uploadUrl = 'https://nostr.build/api/v2/upload/files';

  // 1. Create NIP-98 auth event (kind:27235)
  const unsignedAuthEvent = {
    created_at: Math.floor(Date.now() / 1000),
    kind: 27235,
    tags: [
      ['u', uploadUrl],
      ['method', 'POST']
    ],
    content: ''
  };

  const signedAuthEvent = await signer.signEvent(unsignedAuthEvent);
  const authHeader = `Nostr ${btoa(JSON.stringify(signedAuthEvent))}`;

  // 2. Prepare FormData with image file
  const formData = new FormData();
  formData.append('fileToUpload', file);

  // 3. POST to nostr.build NIP-98 upload endpoint
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader
    },
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text.substring(0, 100)}`);
  }

  const json = await response.json();
  const imageUrl =
    json.data?.[0]?.url ||
    json.data?.url ||
    json.url ||
    json.data?.file?.url;

  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Image uploaded successfully but no URL was returned by server.');
  }

  return imageUrl;
}
