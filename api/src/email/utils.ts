import { Resend } from "resend";

/**
 * Sends a password reset code email to the user.
 * 
 * @param email - The recipient's email address.
 * @param challengeCode - The 6-digit password reset code.
 * @returns A promise that resolves when the email is sent, or rejects on error.
 */
export async function sendPasswordResetEmail(
    email: string,
    challengeCode: string
): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        console.warn("RESEND_API_KEY not configured, skipping email send");
        return;
    }

    try {
        const resend = new Resend(resendApiKey);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
        
        await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "Password Reset Code",
            html: `
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password. Use the following code to complete the reset:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0;">
                    ${challengeCode}
                </p>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this password reset, please ignore this email.</p>
            `,
        });
    } catch (error) {
        // Log error but don't expose it to the caller
        console.error("Failed to send password reset email:", error);
        throw error;
    }
}

