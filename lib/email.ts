export async function sendInviteEmail(to: string, token: string) {
  const base = (process.env.FRONTEND_URL ?? "").replace(/\/$/, "");
  const link = `${base}/invite?token=${token}`;
  const fromEmail = process.env.EMAIL_FROM_ADDRESS ?? "noreply@example.com";
  const fromName = process.env.EMAIL_FROM_NAME ?? "Signal";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111;line-height:1.6">
  <h2 style="margin-bottom:4px">You've been invited to ${fromName}</h2>
  <p style="color:#555;margin-top:4px">Click the button below to set up your profile and get access.</p>
  <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
    Complete your profile
  </a>
  <p style="color:#888;font-size:13px">This link expires in 7 days. After setting up your profile, you can sign back in any time with this email address and the team password.</p>
  <p style="color:#ccc;font-size:12px">If you weren't expecting this, you can ignore this email.</p>
</body>
</html>`;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject: `You've been invited to ${fromName}`,
      content: [{ type: "text/html", value: html }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SendGrid error ${res.status}: ${body}`);
  }
}
