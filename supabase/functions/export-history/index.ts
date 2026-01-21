import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Base64 encode helper for Deno
function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
  completion_notes: string | null;
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
    'Noms des disponibles',
    'Notes de fin'
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
      `"${availableNames.replace(/"/g, '""')}"`,
      `"${(intervention.completion_notes || '').replace(/"/g, '""')}"`
    ].join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
};

const generatePDF = (interventions: Intervention[], startDate?: string, endDate?: string): ArrayBuffer => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const totalInterventions = interventions.length;
  const totalAvailable = interventions.reduce((acc, i) => 
    acc + i.intervention_responses.filter(r => r.status === 'available').length, 0);
  
  const dateRange = startDate || endDate 
    ? `${startDate ? `Du ${formatDate(startDate)}` : ''} ${endDate ? `Au ${formatDate(endDate)}` : ''}`
    : 'Toutes les interventions';

  // Header with blue background
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text('Historique des Interventions', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(dateRange, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, pageWidth / 2, 35, { align: 'center' });
  
  // Stats boxes
  doc.setTextColor(33, 37, 41);
  doc.setFillColor(248, 250, 252);
  
  // Box 1: Total interventions
  doc.roundedRect(14, 50, 85, 25, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(59, 130, 246);
  doc.text(totalInterventions.toString(), 56, 62, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.text('Interventions terminées', 56, 70, { align: 'center' });
  
  // Box 2: Total available
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(110, 50, 85, 25, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94);
  doc.text(totalAvailable.toString(), 152, 62, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.text('Réponses disponibles', 152, 70, { align: 'center' });
  
  // Table header
  let yPos = 90;
  const colWidths = [50, 35, 22, 35, 22, 30];
  const colX = [14, 64, 99, 121, 156, 178];
  const headers = ['Intervention', 'Lieu', 'Urgence', 'Date', 'Dispo', 'Personnes'];
  
  doc.setFillColor(248, 250, 252);
  doc.rect(14, yPos - 5, pageWidth - 28, 10, 'F');
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55, 65, 81);
  headers.forEach((header, i) => {
    doc.text(header, colX[i], yPos);
  });
  
  yPos += 10;
  
  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  
  interventions.forEach((intervention, index) => {
    // Calculate row height based on whether there are completion notes
    const hasNotes = intervention.completion_notes && intervention.completion_notes.trim().length > 0;
    const baseRowHeight = 12;
    const notesRowHeight = hasNotes ? 10 : 0;
    const totalRowHeight = baseRowHeight + notesRowHeight;
    
    if (yPos > pageHeight - 25 - notesRowHeight) {
      doc.addPage();
      yPos = 20;
      
      // Re-draw header on new page
      doc.setFillColor(248, 250, 252);
      doc.rect(14, yPos - 5, pageWidth - 28, 10, 'F');
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(55, 65, 81);
      headers.forEach((header, i) => {
        doc.text(header, colX[i], yPos);
      });
      yPos += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
    }
    
    const availableResponses = intervention.intervention_responses.filter(r => r.status === 'available');
    const unavailableCount = intervention.intervention_responses.filter(r => r.status === 'unavailable').length;
    const availableNames = availableResponses
      .map(r => r.profiles?.full_name || 'Utilisateur')
      .slice(0, 2)
      .join(', ');
    
    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(249, 250, 251);
    }
    doc.rect(14, yPos - 4, pageWidth - 28, totalRowHeight, 'F');
    
    doc.setTextColor(31, 41, 55);
    
    // Title (truncated)
    const title = intervention.title.length > 25 ? intervention.title.substring(0, 22) + '...' : intervention.title;
    doc.text(title, colX[0], yPos);
    
    // Location (truncated)
    const location = intervention.location.length > 18 ? intervention.location.substring(0, 15) + '...' : intervention.location;
    doc.text(location, colX[1], yPos);
    
    // Urgency with color
    const urgencyLabel = getUrgencyLabel(intervention.urgency);
    if (intervention.urgency === 'high') {
      doc.setTextColor(239, 68, 68);
    } else if (intervention.urgency === 'medium') {
      doc.setTextColor(245, 158, 11);
    } else {
      doc.setTextColor(34, 197, 94);
    }
    doc.text(urgencyLabel, colX[2], yPos);
    
    doc.setTextColor(31, 41, 55);
    
    // Date
    doc.text(formatDate(intervention.created_at).split(' ')[0], colX[3], yPos);
    
    // Dispo/Indispo
    doc.setTextColor(34, 197, 94);
    doc.text(`${availableResponses.length}`, colX[4], yPos);
    doc.setTextColor(107, 114, 128);
    doc.text(`/${unavailableCount}`, colX[4] + 6, yPos);
    
    doc.setTextColor(31, 41, 55);
    // Names (truncated)
    const names = availableNames.length > 15 ? availableNames.substring(0, 12) + '...' : (availableNames || '-');
    doc.text(names, colX[5], yPos);
    
    yPos += baseRowHeight;
    
    // Add completion notes if present
    if (hasNotes) {
      doc.setFontSize(6);
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "italic");
      const notesText = intervention.completion_notes!.length > 120 
        ? intervention.completion_notes!.substring(0, 117) + '...' 
        : intervention.completion_notes!;
      doc.text(`Note: ${notesText}`, 16, yPos - 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      yPos += notesRowHeight;
    }
  });
  
  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('Système de gestion des interventions', 14, pageHeight - 10);
  }
  
  return doc.output('arraybuffer');
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

    // ========== AUTHORIZATION CHECK - Admin or Creator ==========
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "creator"]);

    if (roleError) {
      console.error("Error checking role:", roleError.message);
      return new Response(
        JSON.stringify({ error: "Erreur de vérification des permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasPermission = roleData && roleData.length > 0;
    const isCreator = roleData?.some(r => r.role === "creator");

    if (!hasPermission) {
      console.error("User is not an admin or creator");
      return new Response(
        JSON.stringify({ error: "Accès non autorisé. Seuls les administrateurs et créateurs peuvent exporter l'historique." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User has permission (creator: ${isCreator}), proceeding with export`);

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
      const pdfBuffer = generatePDF(typedInterventions, startDate, endDate);
      attachment = arrayBufferToBase64(pdfBuffer);
      filename = `historique-interventions-${new Date().toISOString().split('T')[0]}.pdf`;
      mimeType = "application/pdf";
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
