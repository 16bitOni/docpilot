import { supabase } from '@/integrations/supabase/client';

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

      // Create beautiful HTML email template
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <div style="font-size: 32px; margin-bottom: 10px;">🚀</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">DocPilot</h1>
            <h2 style="margin: 15px 0 0 0; font-size: 20px; font-weight: 400; opacity: 0.9;">You've been invited to collaborate!</h2>
          </div>
          
          <!-- Content -->
          <div style="background: #f8fafc; padding: 40px 30px; border-radius: 0 0 12px 12px;">
            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hi there! 👋</p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                <strong style="color: #1f2937;">${data.inviterName}</strong> has invited you to join the workspace 
                <strong style="color: #667eea;">"${data.workspaceName}"</strong> as a <strong style="color: #059669;">${data.role}</strong>.
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #6b7280;">
                DocPilot is a collaborative document workspace where you can work together with your team in real-time, 
                edit documents, and get AI-powered assistance.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${invitationLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; 
                          font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                          transition: transform 0.2s;">
                  ✨ Accept Invitation
                </a>
              </div>
              
              <!-- Alternative Link -->
              <div style="margin: 30px 0; padding: 20px; background: #f3f4f6; border-radius: 6px; border-left: 4px solid #667eea;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; font-weight: 500;">Or copy and paste this link:</p>
                <p style="margin: 0; font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; color: #374151; word-break: break-all; background: white; padding: 12px; border-radius: 4px; border: 1px solid #e5e7eb;">
                  ${invitationLink}
                </p>
              </div>
              
              <!-- Expiry Notice -->
              <div style="margin: 30px 0 0 0; padding: 15px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  ⏰ <strong>Note:</strong> This invitation will expire in 7 days.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 30px; padding: 20px; color: #9ca3af; font-size: 14px;">
            <p style="margin: 0 0 10px 0;">If you didn't expect this invitation, you can safely ignore this email.</p>
            <p style="margin: 0; font-weight: 500;">© 2024 DocPilot. All rights reserved.</p>
          </div>
        </div>
      `;

      // Create plain text version
      const textContent = `
DocPilot - Invitation to Collaborate

Hi there!

${data.inviterName} has invited you to join the workspace "${data.workspaceName}" as a ${data.role}.

DocPilot is a collaborative document workspace where you can work together with your team in real-time.

Accept your invitation by visiting this link:
${invitationLink}

Note: This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© 2024 DocPilot. All rights reserved.
      `.trim();

      // Send email via Supabase Edge Function
      const { data: result, error } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          to: data.inviteeEmail,
          subject: `You've been invited to join ${data.workspaceName} on DocPilot`,
          html: htmlContent,
          text: textContent,
        },
      });

      if (error) {
        console.error('❌ Supabase Edge Function error:', error);
        return false;
      }

      if (result?.success) {
        console.log(`✅ Email sent successfully via ${result.provider}:`, result.messageId);
        return true;
      } else {
        console.error('❌ Email sending failed:', result?.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Error in sendInvitationEmail:', error);
      return false;
    }
  }
}