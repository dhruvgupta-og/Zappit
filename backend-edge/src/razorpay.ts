export async function createRazorpayOrder(
  keyId: string,
  keySecret: string,
  amountInPaise: number,
  receipt: string,
  currency = 'INR'
) {
  const credentials = btoa(`${keyId}:${keySecret}`);
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt,
    }),
  });

  if (!res.ok) {
    const errorData: any = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.description || `Razorpay order creation failed with status ${res.status}`);
  }

  return await res.json();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    c |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return c === 0;
}

export async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const text = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(text);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, msgData);
  const hashHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(hashHex, signature);
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(webhookSecret);
  const msgData = encoder.encode(rawBody);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, msgData);
  const hashHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(hashHex, signature);
}

