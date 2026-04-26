const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const config = require('../config');

const sesClient = new SESClient({ region: config.AWS_REGION });

async function sendLoginCodeEmail(email, code) {
  const params = {
    Source: config.EMAIL_FROM,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `Curb sign-in code: ${code}`, Charset: 'UTF-8' },
      Body: {
        Text: {
          Data: `Your Curb sign-in code is:\n\n${code}\n\nThis code expires in 10 minutes. If you didn't request it, just ignore this email.\n\n— Curb`,
          Charset: 'UTF-8',
        },
        Html: {
          Data: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0; margin: 0; color: #3b3544; background: #f5f2ee;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff;">
    <div style="padding: 18px 24px; border-bottom: 1px solid #e8e4ed;">
      <span style="font-size: 18px; font-weight: 600; color: #3b3544;">Curb</span>
    </div>
    <div style="padding: 32px 24px 40px;">
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 20px 0; color: #3b3544;">
        Your sign-in code is:
      </p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #8b7ec8; padding: 16px 0; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
        ${code}
      </div>
      <p style="color: #7d7889; font-size: 13px; margin-top: 24px;">
        Code expires in 10 minutes. If you didn't request it, ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
          `.trim(),
          Charset: 'UTF-8',
        },
      },
    },
  };

  return sesClient.send(new SendEmailCommand(params));
}

module.exports = {
  sendLoginCodeEmail,
};
