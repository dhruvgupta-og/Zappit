const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name, college } = req.body;

    if (!email || !name || !college) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Zappit!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f3f4f6; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025); border: 1px solid #e5e7eb;">
      
      <!-- Gradient Header -->
      <div style="background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%); padding: 45px 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">⚡</div>
        <h1 style="font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 1px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Welcome to Zappit!</h1>
        <p style="color: rgba(255, 255, 255, 0.95); font-size: 16px; font-weight: 500; margin: 8px 0 0 0; letter-spacing: 0.5px;">Your campus favorites, delivered instantly.</p>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Hi ${name},</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          We are thrilled to welcome you to the Zappit family! Zappit brings your favorite campus cafes, stores, and snacks directly to you at <strong>${college}</strong>.
        </p>

        <!-- Feature Cards -->
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #f3f4f6; margin-bottom: 30px;">
          <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 15px;">What you can do now</div>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="vertical-align: top;">
              <td style="font-size: 20px; padding-right: 12px; padding-bottom: 16px; width: 30px;">🍔</td>
              <td style="padding-bottom: 16px;">
                <strong style="color: #111827; font-size: 15px; display: block;">Order from Campus Cafes</strong>
                <span style="color: #6b7280; font-size: 14px; margin-top: 2px; display: block;">Skip the queues. Get hot food, beverages, and groceries.</span>
              </td>
            </tr>
            <tr style="vertical-align: top;">
              <td style="font-size: 20px; padding-right: 12px; padding-bottom: 16px;">⚡</td>
              <td style="padding-bottom: 16px;">
                <strong style="color: #111827; font-size: 15px; display: block;">Ultra-fast Campus Delivery</strong>
                <span style="color: #6b7280; font-size: 14px; margin-top: 2px; display: block;">Delivered to your block, library, or campus gate in minutes.</span>
              </td>
            </tr>
            <tr style="vertical-align: top;">
              <td style="font-size: 20px; padding-right: 12px;">📱</td>
              <td>
                <strong style="color: #111827; font-size: 15px; display: block;">Live Order Tracking</strong>
                <span style="color: #6b7280; font-size: 14px; margin-top: 2px; display: block;">Track your delivery agent live with secure OTP validation.</span>
              </td>
            </tr>
          </table>
        </div>

     
        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 10px;">
          <a href="https://zappit.shop" style="display: inline-block; background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%); color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.4), 0 2px 4px -1px rgba(245, 158, 11, 0.2); font-family: inherit;">Explore Campus Stores ➔</a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; line-height: 1.5;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #6b7280;">Welcome to the fast lane!</p>
        <p style="margin: 0;">If you have any questions, reach out to us at <a href="mailto:zappit.shop@gmail.com" style="color: #ff9800; text-decoration: none; font-weight: 600;">support@zappit.shop</a></p>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      const emailResponse = await resend.emails.send({
        from: 'Zappit <hello@zappit.shop>',
        to: email,
        subject: `⚡ Welcome to Zappit, ${name}!`,
        html: htmlContent
      });
      console.log('[Zappit Vercel] Resend Welcome Email sent successfully to:', email, emailResponse);
      return res.status(200).json({ success: true, message: `Welcome email sent successfully to ${email}`, data: emailResponse });
    } else {
      console.log('========================================================================');
      console.log('[Zappit Vercel] MOCK WELCOME EMAIL SENT (RESEND_API_KEY is missing or unconfigured)');
      console.log(`To: ${email}`);
      console.log(`Subject: ⚡ Welcome to Zappit, ${name}!`);
      console.log(`College: ${college}`);
      console.log('========================================================================');
      return res.status(200).json({ 
        success: true, 
        message: 'Mock welcome email logged to serverless console (RESEND_API_KEY missing)',
        mocked: true 
      });
    }

  } catch (err) {
    console.error('Serverless Send Welcome Email Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
