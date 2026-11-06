export async function sendExpoPushNotification(
  to: string | string[],
  title: string,
  body: string,
  data?: Record<string, any>
) {
  const recipients = Array.isArray(to) ? to : [to];
  const validTokens = recipients.filter((t) => t && t.startsWith('ExponentPushToken'));

  if (validTokens.length === 0) return null;

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: data || {},
    priority: 'high',
  }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    return await res.json().catch(() => null);
  } catch (err: any) {
    console.warn('[Push Notification] Error sending to Expo:', err.message);
    return null;
  }
}

