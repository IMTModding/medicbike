import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPasswordRecoveryRequest {
  email: string;
  redirectTo?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectTo }: SendPasswordRecoveryRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Avoid leaking whether an email exists.
    // We still try to generate the link and send the email when possible.
    let actionLink: string | null = null;
    try {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: redirectTo || undefined,
        },
      });

      if (error) {
        console.error("generateLink error:", error);
      } else {
        actionLink = (data as any)?.properties?.action_link ?? null;
      }
    } catch (e) {
      console.error("generateLink exception:", e);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && actionLink) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "MedicBike <onboarding@resend.dev>",
          to: [email],
          subject: "Réinitialisation de votre mot de passe MedicBike",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #111;">Réinitialisation du mot de passe</h1>
              <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
              <p>Pour choisir un nouveau mot de passe, cliquez sur le bouton ci-dessous :</p>
              <p style="margin: 24px 0;">
                <a href="${actionLink}" style="display: inline-block; background: #111; color: #fff; padding: 12px 16px; border-radius: 8px; text-decoration: none;">
                  Réinitialiser mon mot de passe
                </a>
              </p>
              <p style="color:#666; font-size: 14px;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        console.error("Resend error:", errorData);
        // Return a generic message to the client.
      }
    } else {
      if (!resendApiKey) console.warn("RESEND_API_KEY not configured");
      if (!actionLink) console.warn("No action link generated; email not sent");
    }

    // Always return success to avoid account enumeration
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-password-recovery function:", error);
    return new Response(
      JSON.stringify({ error: "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
