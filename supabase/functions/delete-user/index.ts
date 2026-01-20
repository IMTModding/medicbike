import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
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
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the requester is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      console.error("Invalid token:", userError);
      return new Response(
        JSON.stringify({ error: "Token invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin or creator
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    const isCreator = roleData?.role === "creator";
    const isAdmin = roleData?.role === "admin" || isCreator;

    if (roleError || !isAdmin) {
      console.error("User is not admin:", roleError);
      return new Response(
        JSON.stringify({ error: "Seuls les administrateurs peuvent supprimer des utilisateurs" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "ID utilisateur requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user to delete belongs to the admin's organization
    const { data: profileToDelete, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("admin_id, invite_code_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profileToDelete) {
      console.error("User not found:", profileError);
      return new Response(
        JSON.stringify({ error: "Utilisateur non trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Creator can delete ANY user, admins can only delete users in their organization
    if (!isCreator) {
      const { data: adminCodes } = await supabaseAdmin
        .from("invite_codes")
        .select("id")
        .eq("admin_id", userData.user.id);

      const adminCodeIds = (adminCodes || []).map(c => c.id);
      
      const belongsToAdmin = 
        profileToDelete.admin_id === userData.user.id ||
        (profileToDelete.invite_code_id && adminCodeIds.includes(profileToDelete.invite_code_id));

      if (!belongsToAdmin) {
        console.error("User does not belong to admin's organization");
        return new Response(
          JSON.stringify({ error: "Cet utilisateur n'appartient pas à votre organisation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Prevent admin from deleting themselves
    if (userId === userData.user.id) {
      return new Response(
        JSON.stringify({ error: "Vous ne pouvez pas supprimer votre propre compte" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deleting user: ${userId}`);

    // Delete user from auth (this will cascade to profiles, user_roles, etc.)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${userId} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true, message: "Utilisateur supprimé définitivement" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});