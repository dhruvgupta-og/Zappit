const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, orderIds, storeNames, items, totalAmount, deliveryOtp, address, fees, appliedCoupon } = req.body;

    if (!email || !orderIds || !items || totalAmount === undefined || !deliveryOtp) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);

    const itemsHtml = items.map(item => `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 0; font-size: 15px; color: #1f2937;">
          <span style="font-weight: 600;">${item.name}</span>
          <span style="color: #6b7280; margin-left: 6px;">x${item.qty}</span>
        </td>
        <td style="padding: 12px 0; font-size: 14px; color: #6b7280; text-align: center;">${item.storeName || 'Store'}</td>
        <td style="padding: 12px 0; font-size: 15px; color: #1f2937; text-align: right; font-weight: 500;">₹${Number(item.price) * Number(item.qty)}</td>
      </tr>
    `).join('');

    let feesHtml = '';
    if (fees && Array.isArray(fees)) {
      feesHtml = fees.map(f => `
        <tr>
          <td colspan="2" style="padding: 6px 0; font-size: 14px; color: #4b5563;">${f.name}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #4b5563; text-align: right;">₹${f.value}</td>
        </tr>
      `).join('');
    }

    let discountHtml = '';
    if (appliedCoupon) {
      const discountVal = Math.round((subtotal * Number(appliedCoupon.discount_percent)) / 100);
      discountHtml = `
        <tr style="color: #10b981;">
          <td colspan="2" style="padding: 6px 0; font-size: 14px; font-weight: 500;">Discount (${appliedCoupon.code} - ${appliedCoupon.discount_percent}%)</td>
          <td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 600;">-₹${discountVal}</td>
        </tr>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed - Zappit</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
  <div style="width: 100%; background-color: #f3f4f6; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025); border: 1px solid #e5e7eb;">
      
      <!-- Brand Header -->
      <div style="background: linear-gradient(135deg, #FFC107 0%, #FF9800 100%); padding: 35px 30px; text-align: center;">
        <h1 style="font-size: 30px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">⚡ ZAPPIT</h1>
        <p style="color: rgba(255, 255, 255, 0.95); font-size: 14px; font-weight: 500; margin: 6px 0 0 0; letter-spacing: 0.5px;">Campus Delivery, Instantly</p>
      </div>

      <!-- Main Receipt Card -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 8px;">Order Confirmed! 🎉</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
          Hi there! Your payment was processed successfully. The store is preparing your items. You can find your delivery OTP and receipt below.
        </p>
        
        <!-- OTP Card -->
        <div style="background-color: #fffbeb; border: 2px dashed #fcd34d; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 35px;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #b45309; font-weight: 700; margin-bottom: 8px;">Share this OTP with your Delivery Partner</div>
          <div style="font-size: 42px; font-weight: 900; color: #d97706; letter-spacing: 6px; margin: 0; line-height: 1;">${deliveryOtp}</div>
        </div>
        
        <!-- Items Table -->
        <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 12px;">Items Ordered</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tbody>
            ${itemsHtml}
            <tr>
              <td colspan="2" style="padding: 12px 0 6px 0; font-size: 14px; color: #4b5563;">Subtotal</td>
              <td style="padding: 12px 0 6px 0; font-size: 14px; color: #4b5563; text-align: right;">₹${subtotal}</td>
            </tr>
            ${feesHtml}
            ${discountHtml}
            <tr style="border-top: 2px solid #f3f4f6;">
              <td colspan="2" style="padding: 16px 0 0 0; font-size: 18px; font-weight: 800; color: #111827;">Total Amount Paid</td>
              <td style="padding: 16px 0 0 0; font-size: 18px; font-weight: 800; color: #111827; text-align: right;">₹${totalAmount}</td>
            </tr>
          </tbody>
        </table>
        
        <!-- Metadata Info Section -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 25px; margin-top: 30px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px;">Delivery Address</div>
                <div style="font-size: 14px; color: #374151; line-height: 1.5; font-weight: 500;">${address}</div>
              </td>
              <td style="width: 50%; vertical-align: top;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px;">Order ID(s)</div>
                <div style="font-size: 13px; color: #6b7280; font-family: monospace; line-height: 1.4; word-break: break-all;">${orderIds.join(', ')}</div>
              </td>
            </tr>
          </table>
        </div>

      </div>
      
      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; line-height: 1.5;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #6b7280;">Thank you for ordering with Zappit!</p>
        <p style="margin: 0;">If you have any questions, reach out to us at <a href="mailto:support@zappit.com" style="color: #ff9800; text-decoration: none; font-weight: 600;">support@zappit.com</a></p>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      const targetEmail = process.env.RESEND_TEST_RECIPIENT || email;
      const emailResponse = await resend.emails.send({
        from: 'Zappit <onboarding@resend.dev>',
        to: targetEmail,
        subject: `⚡ Zappit Order Confirmed - OTP: ${deliveryOtp}`,
        html: htmlContent
      });
      console.log('[Zappit Vercel] Resend Email sent successfully to:', targetEmail, emailResponse);
      return res.status(200).json({ success: true, message: `Email sent successfully to ${targetEmail}`, data: emailResponse });
    } else {
      console.log('========================================================================');
      console.log('[Zappit Vercel] MOCK EMAIL SENT (RESEND_API_KEY is missing or unconfigured)');
      console.log(`To: ${email}`);
      console.log(`Subject: ⚡ Zappit Order Confirmed - OTP: ${deliveryOtp}`);
      console.log(`Order IDs: ${orderIds.join(', ')}`);
      console.log(`Total Paid: ₹${totalAmount}`);
      console.log('========================================================================');
      return res.status(200).json({ 
        success: true, 
        message: 'Mock email logged to serverless console (RESEND_API_KEY missing)',
        mocked: true 
      });
    }

  } catch (err) {
    console.error('Serverless Send Order Email Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
