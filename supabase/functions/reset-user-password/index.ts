import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  userId: string;
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

    const requesterId = claimsData.claims.sub as string;

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is admin or creator
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .single();

    const isCreator = roleData?.role === "creator";
    const isAdmin = roleData?.role === "admin" || isCreator;

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Seuls les administrateurs peuvent réinitialiser les mots de passe" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId }: ResetPasswordRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "ID utilisateur requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the target user belongs to admin's organization
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("admin_id, invite_code_id, full_name")
      .eq("user_id", userId)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Creator can reset ANY user's password, admins can only reset their organization's users
    if (!isCreator) {
      const { data: adminCodes } = await supabaseAdmin
        .from("invite_codes")
        .select("id")
        .eq("admin_id", requesterId);

      const adminCodeIds = (adminCodes || []).map(c => c.id);
      const belongsToAdmin = targetProfile.admin_id === requesterId || 
                            (targetProfile.invite_code_id && adminCodeIds.includes(targetProfile.invite_code_id));

      if (!belongsToAdmin) {
        return new Response(
          JSON.stringify({ error: "Cet utilisateur n'appartient pas à votre organisation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate a new temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Password reset for user ${userId} (${targetProfile.full_name})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tempPassword,
        userName: targetProfile.full_name
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in reset-user-password function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
