import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"Bug App Security" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your 6-Digit Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #0a0a1a; padding: 40px; color: #fff; text-align: center;">
        <h1 style="color: #6366f1;">Welcome to Bug App!</h1>
        <p style="font-size: 16px; color: #9ca3af;">Please use the following 6-digit verification code to complete your registration.</p>
        
        <div style="margin: 30px auto; padding: 20px; background-color: #1e1e2e; border-radius: 8px; border: 1px solid #6366f1; display: inline-block;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #fff;">${otpCode}</span>
        </div>
        
        <p style="font-size: 14px; color: #9ca3af;">This code will expire in 10 minutes.</p>
        <p style="font-size: 12px; color: #4b5563; margin-top: 40px;">If you did not request this code, please ignore this email.</p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  
  console.log('Email sent successfully: %s', info.messageId);
  
  return null;
};
