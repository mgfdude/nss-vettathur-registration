const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');

// Create reusable transporter object using SMTP transport or Ethereal/Mailtrap fallback
let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  // For development, if SMTP is not explicitly configured, we can generate a test SMTP account via Ethereal
  if (config.email.host === 'smtp.ethereal.email' && config.email.user === 'test@ethereal.email') {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('Ethereal Mail SMTP Transporter Configured:', testAccount.user);
    } catch (err) {
      console.error('Failed to create Ethereal SMTP fallback:', err);
    }
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass
      }
    });
  }

  return transporter;
}

/**
 * Send email using HTML templates
 * @param {string} to Receiver email address
 * @param {string} subject Subject line
 * @param {string} templateName Name of the HTML template file (e.g. 'otp.html')
 * @param {Object} replacements Variables to replace in the HTML (e.g. { OTP_CODE: '123456' })
 */
async function sendMail(to, subject, templateName, replacements) {
  try {
    const clientTransporter = await getTransporter();
    const templatePath = path.join(__dirname, '..', '..', 'email_templates', templateName);
    let htmlContent = await fs.readFile(templatePath, 'utf8');

    const mergedReplacements = {
      STUDENT_NAME: 'Student',
      PORTAL_URL: config.portalUrl,
      WEBSITE_URL: config.portalUrl,
      CONTACT_EMAIL: config.contactEmail,
      REQUEST_TIME: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      OTP_VALIDITY: '10 minutes',
      YEAR: new Date().getFullYear(),
      BATCH: 'NSS Vettathur',
      SELECTION_STATUS: '',
      APP_ID: '',
      ...replacements
    };

    // Replace variables
    for (const [key, value] of Object.entries(mergedReplacements)) {
      htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    const mailOptions = {
      from: `"NSS Vettathur" <${config.email.user}>`,
      to,
      subject,
      html: htmlContent
    };

    const info = await clientTransporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = {
  sendMail
};
