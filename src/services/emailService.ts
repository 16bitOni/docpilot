interface InvitationEmailData {
  inviteeEmail: string;
  inviterName: string;
  workspaceName: string;
  invitationToken: string;
  role: string;
}

export class EmailService {
  static async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    try {
      // Create the invitation link
      const invitationLink = `${window.location.origin}/invite/${data.invitationToken}`;

      console.log('📧 Sending email to:', data.inviteeEmail);
      console.log('🔗 Invitation link:', invitationLink);

      // Send email via Python backend (which will use Resend)
      const response = await fetch('http://localhost:8000/api/send-invitation-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: data.inviteeEmail,
          subject: `You've been invited to join ${data.workspaceName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1>🚀 DocPilot</h1>
                <h2>You've been invited to collaborate!</h2>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
                <p>Hi there!</p>
                <p><strong>${data.inviterName}</strong> has invited you to join the workspace <strong>"${data.workspaceName}"</strong> as a <strong>${data.role}</strong>.</p>
                <p>DocPilot is a collaborative document workspace where you can work together with your team in real-time.</p>
                <p>Click the button below to accept the invitation:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${invitationLink}" style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="background: #eee; padding: 15px; border-radius: 4px; word-break: break-all; font-family: monospace;">${invitationLink}</p>
                <p><strong>Note:</strong> This invitation will expire in 7 days.</p>
              </div>
              <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                <p>© 2024 DocPilot. All rights reserved.</p>
              </div>
            </div>
          `,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Backend email error:', result);
        return false;
      }

      if (result.success) {
        console.log('✅ Email sent successfully:', result.message_id);
        return true;
      } else {
        console.error('❌ Email sending failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error in sendInvitationEmail:', error);
      return false;
    }
  }
}