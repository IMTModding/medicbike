import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Base64 encode helper for Deno
function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExportRequest {
  email: string;
  format: "csv" | "pdf";
  startDate?: string;
  endDate?: string;
}

interface InterventionResponse {
  id: string;
  status: string;
  user_id: string;
  profiles: { full_name: string | null } | null;
}

interface Intervention {
  id: string;
  title: string;
  description: string | null;
  location: string;
  urgency: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
  intervention_responses: InterventionResponse[];
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getUrgencyLabel = (urgency: string): string => {
  switch (urgency) {
    case 'high': return 'Urgent';
    case 'medium': return 'Moyen';
    case 'low': return 'Normal';
    default: return urgency;
  }
};

const generateCSV = (interventions: Intervention[]): string => {
  const headers = [
    'Titre',
    'Description',
    'Lieu',
    'Urgence',
    'Date de création',
    'Date de fin',
    'Disponibles',
    'Indisponibles',
    'Noms des disponibles'
  ];

  const rows = interventions.map(intervention => {
    const availableResponses = intervention.intervention_responses.filter(r => r.status === 'available');
    const unavailableCount = intervention.intervention_responses.filter(r => r.status === 'unavailable').length;
    const availableNames = availableResponses
      .map(r => r.profiles?.full_name || 'Utilisateur')
      .join(', ');

    return [
      `"${intervention.title.replace(/"/g, '""')}"`,
      `"${(intervention.description || '').replace(/"/g, '""')}"`,
      `"${intervention.location.replace(/"/g, '""')}"`,
      getUrgencyLabel(intervention.urgency),
      formatDate(intervention.created_at),
      intervention.completed_at ? formatDate(intervention.completed_at) : '',
      availableResponses.length.toString(),
      unavailableCount.toString(),
      `"${availableNames.replace(/"/g, '""')}"`
    ].join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
};

const generatePDFHTML = (interventions: Intervention[], startDate?: string, endDate?: string): string => {
  const totalInterventions = interventions.length;
  const totalAvailable = interventions.reduce((acc, i) => 
    acc + i.intervention_responses.filter(r => r.status === 'available').length, 0);
  
  const dateRange = startDate || endDate 
    ? `${startDate ? `Du ${formatDate(startDate)}` : ''} ${endDate ? `Au ${formatDate(endDate)}` : ''}`
    : 'Toutes les interventions';

  const rows = interventions.map(intervention => {
    const availableResponses = intervention.intervention_responses.filter(r => r.status === 'available');
    const unavailableCount = intervention.intervention_responses.filter(r => r.status === 'unavailable').length;
    const availableNames = availableResponses
      .map(r => r.profiles?.full_name || 'Utilisateur')
      .join(', ');

    const urgencyColor = intervention.urgency === 'high' ? '#ef4444' : 
                        intervention.urgency === 'medium' ? '#f59e0b' : '#22c55e';

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${intervention.title}</strong>
          ${intervention.description ? `<br><span style="color: #6b7280; font-size: 12px;">${intervention.description}</span>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${intervention.location}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="background-color: ${urgencyColor}20; color: ${urgencyColor}; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
            ${getUrgencyLabel(intervention.urgency)}
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">
          ${formatDate(intervention.created_at)}
          ${intervention.completed_at ? `<br><span style="color: #22c55e;">Terminée: ${formatDate(intervention.completed_at)}</span>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="color: #22c55e; font-weight: bold;">${availableResponses.length}</span> / 
          <span style="color: #6b7280;">${unavailableCount}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">
          ${availableNames || '-'}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { margin: 0 0 10px 0; font-size: 24px; }
        .header p { margin: 0; opacity: 0.9; }
        .stats { display: flex; gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; flex: 1; text-align: center; }
        .stat-value { font-size: 28px; font-weight: bold; color: #3b82f6; }
        .stat-label { font-size: 14px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: #f8fafc; padding: 14px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
        .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚨 Historique des Interventions</h1>
        <p>${dateRange}</p>
        <p>Généré le ${formatDate(new Date().toISOString())}</p>
      </div>
      
      <div class="stats">
        <div class="stat-card">
          <div class="stat-value">${totalInterventions}</div>
          <div class="stat-label">Interventions terminées</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalAvailable}</div>
          <div class="stat-label">Total réponses disponibles</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Intervention</th>
            <th>Lieu</th>
            <th>Urgence</th>
            <th>Dates</th>
            <th>Dispo/Indispo</th>
            <th>Personnes disponibles</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Document généré automatiquement - Système de gestion des interventions</p>
      </div>
    </body>
    </html>
  `;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Export history request received");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create a client with the user's token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Authentification invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // ========== AUTHORIZATION CHECK - Admin Only ==========
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Error checking role:", roleError.message);
      return new Response(
        JSON.stringify({ error: "Erreur de vérification des permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.error("User is not an admin");
      return new Response(
        JSON.stringify({ error: "Accès non autorisé. Seuls les administrateurs peuvent exporter l'historique." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User is admin, proceeding with export");

    // ========== GET ADMIN'S ORGANIZATION INFO ==========
    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Error getting admin profile:", profileError.message);
    }

    // Get all invite codes created by this admin
    const { data: adminInviteCodes, error: inviteError } = await supabase
      .from("invite_codes")
      .select("id")
      .eq("admin_id", user.id);

    if (inviteError) {
      console.error("Error getting admin invite codes:", inviteError.message);
    }

    const inviteCodeIds = adminInviteCodes?.map(ic => ic.id) || [];

    // Get all users in admin's organization (employees who used admin's invite codes)
    const { data: orgUsers, error: orgError } = await supabase
      .from("profiles")
      .select("user_id")
      .or(`admin_id.eq.${user.id}${inviteCodeIds.length > 0 ? `,invite_code_id.in.(${inviteCodeIds.join(",")})` : ""}`);

    if (orgError) {
      console.error("Error getting org users:", orgError.message);
    }

    // List of user IDs in this admin's organization (including the admin)
    const orgUserIds = [...new Set([user.id, ...(orgUsers?.map(u => u.user_id) || [])])];

    console.log(`Admin organization has ${orgUserIds.length} users`);

    // ========== PROCESS REQUEST ==========
    const { email, format, startDate, endDate }: ExportRequest = await req.json();
    console.log(`Exporting ${format} to ${email}, dates: ${startDate} - ${endDate}`);

    if (!email || !format) {
      return new Response(
        JSON.stringify({ error: "Email et format requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Format d'email invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FETCH INTERVENTIONS - ONLY FROM ADMIN'S ORGANIZATION ==========
    let query = supabase
      .from('interventions')
      .select(`
        *,
        intervention_responses (
          id,
          status,
          user_id
        )
      `)
      .eq('status', 'completed')
      .in('created_by', orgUserIds) // Only interventions created by users in this organization
      .order('completed_at', { ascending: false });

    if (startDate) {
      query = query.gte('completed_at', startDate);
    }
    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      query = query.lte('completed_at', endDateObj.toISOString());
    }

    const { data: interventions, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching interventions:", fetchError);
      throw new Error(`Erreur de récupération: ${fetchError.message}`);
    }

    console.log(`Found ${interventions?.length || 0} interventions for this organization`);

    // Get all unique user IDs from responses to fetch their profiles
    const allResponseUserIds = new Set<string>();
    (interventions || []).forEach((intervention: any) => {
      (intervention.intervention_responses || []).forEach((r: any) => {
        if (r.user_id) allResponseUserIds.add(r.user_id);
      });
    });

    // Fetch profiles for all response users
    let userProfilesMap: Record<string, string> = {};
    if (allResponseUserIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(allResponseUserIds));
      
      (profiles || []).forEach((p: any) => {
        userProfilesMap[p.user_id] = p.full_name || 'Utilisateur';
      });
    }

    // Map interventions with profile names
    const typedInterventions: Intervention[] = (interventions || []).map((intervention: any) => ({
      ...intervention,
      intervention_responses: (intervention.intervention_responses || []).map((r: any) => ({
        ...r,
        profiles: { full_name: userProfilesMap[r.user_id] || null }
      }))
    }));

    let attachment;
    let filename: string;
    let mimeType: string;

    if (format === "csv") {
      const csvContent = generateCSV(typedInterventions);
      // Add BOM for Excel UTF-8 compatibility
      const csvWithBOM = '\uFEFF' + csvContent;
      attachment = toBase64(csvWithBOM);
      filename = `historique-interventions-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = "text/csv";
    } else {
      const htmlContent = generatePDFHTML(typedInterventions, startDate, endDate);
      attachment = toBase64(htmlContent);
      filename = `historique-interventions-${new Date().toISOString().split('T')[0]}.html`;
      mimeType = "text/html";
    }

    const dateRangeText = startDate || endDate 
      ? `${startDate ? `du ${formatDate(startDate)}` : ''} ${endDate ? `au ${formatDate(endDate)}` : ''}`
      : 'complet';

    const emailResponse = await resend.emails.send({
      from: "Interventions <onboarding@resend.dev>",
      to: [email],
      subject: `Export historique des interventions - ${typedInterventions.length} intervention(s)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">📊 Export de l'historique</h1>
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint l'export de l'historique des interventions ${dateRangeText}.</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📋 ${typedInterventions.length}</strong> intervention(s) terminée(s)</p>
            <p style="margin: 10px 0 0 0;"><strong>📄 Format:</strong> ${format.toUpperCase()}</p>
          </div>
          <p>Cordialement,<br>Le système de gestion des interventions</p>
        </div>
      `,
      attachments: [
        {
          filename,
          content: attachment,
        }
      ]
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Export envoyé à ${email}`,
        count: typedInterventions.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error("Error in export-history:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
