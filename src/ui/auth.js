import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

export function friendlyError(error) {
  const messages = {
    'auth/invalid-phone-number': 'Use your full phone number with country code, for example +94771234567.',
    'auth/invalid-verification-code': 'That code is incorrect. Check the SMS and try again.',
    'auth/code-expired': 'That code expired. Request a new code.',
    'auth/session-expired': 'That code expired. Request a new code.',
    'auth/too-many-requests': 'Firebase has temporarily limited requests. Wait before trying again.',
    'auth/quota-exceeded': 'The project’s SMS quota was reached. Check Firebase billing and SMS limits.',
    'auth/operation-not-allowed': 'Enable Phone sign-in and your SMS region in Firebase Console.',
    'auth/unauthorized-domain': 'Add this deployed domain to Firebase Authentication’s authorized domains.',
    'auth/captcha-check-failed': 'Verification failed. Check the authorized domain and try reCAPTCHA again.',
    'auth/invalid-app-credential': 'Phone verification failed. Check the Firebase configuration and authorized domain.',
    'auth/network-request-failed': 'Could not connect. Check your internet connection and try again.',
    'auth/invalid-api-key': 'Check VITE_FIREBASE_API_KEY and restart Vite.',
    'PERMISSION_DENIED': 'Database access denied. Publish database.rules.json to your Realtime Database.',
  };
  return messages[error.code] ?? (String(error.message).toLowerCase().includes('permission_denied') ? messages.PERMISSION_DENIED : error.message || 'Something went wrong. Please try again.');
}

export function createPhoneLogin(auth) {
  const phoneForm = document.querySelector('#phone-form');
  const otpForm = document.querySelector('#otp-form');
  const status = document.querySelector('#auth-status');
  const phone = document.querySelector('#phone-number');
  const code = document.querySelector('#otp-code');
  const resend = document.querySelector('#restart-otp');
  let verifier;
  let confirmation;
  let busy = false;
  let nextSendAt = 0;
  let revision = 0;
  function clearCaptcha() { verifier?.clear(); verifier = undefined; }
  function setBusy(value) {
    busy = value;
    phoneForm.querySelector('button').disabled = value;
    otpForm.querySelector('button').disabled = value;
    resend.disabled = value;
  }
  phoneForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const number = phone.value.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(number)) { status.textContent = 'Enter a phone number with country code, such as +94771234567.'; return; }
    if (Date.now() < nextSendAt) { status.textContent = `Wait ${Math.ceil((nextSendAt - Date.now()) / 1000)} seconds before requesting another SMS.`; return; }
    const attempt = revision;
    setBusy(true);
    status.textContent = 'Complete the verification to receive your code.';
    try {
      clearCaptcha();
      verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
      const result = await signInWithPhoneNumber(auth, number, verifier);
      if (attempt !== revision) return;
      confirmation = result;
      nextSendAt = Date.now() + 60000;
      phoneForm.hidden = true;
      otpForm.hidden = false;
      status.textContent = `Code sent to ${number}. Enter the six-digit code below.`;
      code.focus();
    } catch (error) { if (attempt === revision) status.textContent = friendlyError(error); }
    finally { if (attempt === revision) { clearCaptcha(); setBusy(false); } }
  });
  otpForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !confirmation) return;
    if (!/^\d{6}$/.test(code.value.trim())) { status.textContent = 'Enter the six-digit code from your SMS.'; return; }
    const attempt = revision;
    setBusy(true);
    status.textContent = 'Verifying your code…';
    try { await confirmation.confirm(code.value.trim()); }
    catch (error) { if (attempt === revision) status.textContent = friendlyError(error); }
    finally { if (attempt === revision) setBusy(false); }
  });
  resend.addEventListener('click', () => {
    confirmation = undefined;
    code.value = '';
    otpForm.hidden = true;
    phoneForm.hidden = false;
    status.textContent = 'Check your number, then request a new code. Requests are spaced one minute apart.';
    phone.focus();
  });
  return {
    reset() {
      revision++;
      clearCaptcha();
      confirmation = undefined;
      phoneForm.reset();
      otpForm.reset();
      phoneForm.hidden = false;
      otpForm.hidden = true;
      status.textContent = '';
      setBusy(false);
    },
  };
}
