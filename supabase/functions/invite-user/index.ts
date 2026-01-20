import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  fullName: string;
  role: "admin" | "employee";
  inviteCodeId?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with user's token for verification
    const supabaseWithAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the token using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseWithAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Invalid token:", claimsError);
      return new Response(
        JSON.stringify({ error: "Token invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is admin or creator
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const isCreator = roleData?.role === "creator";
    const isAdmin = roleData?.role === "admin" || isCreator;

    if (roleError || !isAdmin) {
      console.error("User is not admin:", roleError);
      return new Response(
        JSON.stringify({ error: "Seuls les administrateurs peuvent inviter des utilisateurs" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, fullName, role, inviteCodeId }: InviteUserRequest = await req.json();

    // Validate input
    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ error: "Email et nom requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Inviting user: ${email} as ${role}`);

    // Generate a random password
    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      
      if (createError.message.includes("already been registered")) {
        // Return 200 with error in body so frontend can read it
        return new Response(
          JSON.stringify({ success: false, error: "Cet email est déjà enregistré dans le système" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Erreur lors de la création de l'utilisateur" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User created: ${newUser.user.id}`);

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update the user's role if admin
    if (role === "admin") {
      const { error: updateRoleError } = await supabaseAdmin
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", newUser.user.id);

      if (updateRoleError) {
        console.error("Error updating role:", updateRoleError);
      }
    }

    // Update or create profile with organization linkage using upsert
    const profileData: Record<string, unknown> = {
      user_id: newUser.user.id,
      full_name: fullName,
    };

    if (role === "employee" && inviteCodeId) {
      profileData.invite_code_id = inviteCodeId;
      profileData.admin_id = userId;
    } else if (role === "admin") {
      profileData.admin_id = newUser.user.id;
    }

    // First try to update existing profile
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", newUser.user.id)
      .single();

    if (existingProfile) {
      // Profile exists, update it
      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update(profileData)
        .eq("user_id", newUser.user.id);

      if (updateProfileError) {
        console.error("Error updating profile:", updateProfileError);
      } else {
        console.log("Profile updated with organization info");
      }
    } else {
      // Profile doesn't exist, create it
      const { error: insertProfileError } = await supabaseAdmin
        .from("profiles")
        .insert(profileData);

      if (insertProfileError) {
        console.error("Error inserting profile:", insertProfileError);
      } else {
        console.log("Profile created with organization info");
      }
    }

    // Store contact info in profile_contacts (profiles table does not contain email/phone)
    const { error: contactError } = await supabaseAdmin
      .from("profile_contacts")
      .upsert(
        {
          user_id: newUser.user.id,
          email,
        },
        { onConflict: "user_id" }
      );

    if (contactError) {
      console.error("Error updating profile contacts:", contactError);
    }

    // Send invitation email using fetch to Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "MedicBike <onboarding@resend.dev>",
            to: [email],
            subject: "Invitation à rejoindre MedicBike",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Bienvenue sur MedicBike !</h1>
                <p>Bonjour ${fullName},</p>
                <p>Vous avez été invité(e) à rejoindre l'équipe MedicBike.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Vos identifiants de connexion :</strong></p>
                  <p>Email : <strong>${email}</strong></p>
                  <p>Mot de passe temporaire : <strong>${tempPassword}</strong></p>
                </div>
                <p style="color: #666; font-size: 14px;">
                  ⚠️ Pour votre sécurité, nous vous recommandons de changer votre mot de passe après votre première connexion.
                </p>
                <p>À bientôt sur MedicBike !</p>
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          console.log("Invitation email sent successfully");
          emailSent = true;
        } else {
          const errorData = await emailResponse.json();
          console.error("Error sending email:", errorData);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping email");
    }

    // Always return the tempPassword so admin can share it manually if email fails
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        emailSent,
        message: emailSent 
          ? "Utilisateur créé et invitation envoyée par email" 
          : "Utilisateur créé (email non envoyé - partagez les identifiants manuellement)",
        tempPassword // Always include for manual sharing
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
