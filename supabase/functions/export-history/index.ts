import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  
  doc.roundedRect(14, 50, 85, 25, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(59, 130, 246);
  doc.text(totalInterventions.toString(), 56, 62, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.text('Interventions terminées', 56, 70, { align: 'center' });
  
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
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  
  interventions.forEach((intervention, index) => {
    const hasNotes = intervention.completion_notes && intervention.completion_notes.trim().length > 0;
    const availableResponses = intervention.intervention_responses.filter(r => r.status === 'available');
    const hasAvailableEmployees = availableResponses.length > 0;
    const showDetails = hasNotes || hasAvailableEmployees;
    const baseRowHeight = 12;
    const notesRowHeight = showDetails ? (hasNotes && hasAvailableEmployees ? 14 : 10) : 0;
    const totalRowHeight = baseRowHeight + notesRowHeight;
    
    if (yPos > pageHeight - 25 - notesRowHeight) {
      doc.addPage();
      yPos = 20;
      
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
    
    const unavailableCount = intervention.intervention_responses.filter(r => r.status === 'unavailable').length;
    const availableNames = availableResponses
      .map(r => r.profiles?.full_name || 'Utilisateur')
      .slice(0, 2)
      .join(', ');
    
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(249, 250, 251);
    }
    doc.rect(14, yPos - 4, pageWidth - 28, totalRowHeight, 'F');
    
    doc.setTextColor(31, 41, 55);
    
    const title = intervention.title.length > 25 ? intervention.title.substring(0, 22) + '...' : intervention.title;
    doc.text(title, colX[0], yPos);
    
    const location = intervention.location.length > 18 ? intervention.location.substring(0, 15) + '...' : intervention.location;
    doc.text(location, colX[1], yPos);
    
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
    doc.text(formatDate(intervention.created_at).split(' ')[0], colX[3], yPos);
    
    doc.setTextColor(34, 197, 94);
    doc.text(`${availableResponses.length}`, colX[4], yPos);
    doc.setTextColor(107, 114, 128);
    doc.text(`/${unavailableCount}`, colX[4] + 6, yPos);
    
    doc.setTextColor(31, 41, 55);
    const names = availableNames.length > 15 ? availableNames.substring(0, 12) + '...' : (availableNames || '-');
    doc.text(names, colX[5], yPos);
    
    yPos += baseRowHeight;
    
    const allAvailableEmployeeNames = availableResponses
      .map(r => r.profiles?.full_name || 'Utilisateur')
      .join(', ');
    
    if (showDetails) {
      doc.setFontSize(6);
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "italic");
      
      let noteLineYPos = yPos - 2;
      
      if (hasAvailableEmployees) {
        const employeesText = `Intervenants (${availableResponses.length}): ${allAvailableEmployeeNames}`;
        const truncatedEmployees = employeesText.length > 120 
          ? employeesText.substring(0, 117) + '...' 
          : employeesText;
        doc.text(truncatedEmployees, 16, noteLineYPos);
        noteLineYPos += 4;
      }
      
      if (hasNotes) {
        const notesText = intervention.completion_notes!.length > 100 
          ? intervention.completion_notes!.substring(0, 97) + '...' 
          : intervention.completion_notes!;
        doc.text(`Note: ${notesText}`, 16, noteLineYPos);
      }
      
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
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
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

    // ========== AUTHORIZATION CHECK ==========
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

    // ========== GET ORGANIZATION INFO ==========
    const { data: adminInviteCodes } = await supabase
      .from("invite_codes")
      .select("id")
      .eq("admin_id", user.id);

    const inviteCodeIds = adminInviteCodes?.map(ic => ic.id) || [];

    const { data: orgUsers } = await supabase
      .from("profiles")
      .select("user_id")
      .or(`admin_id.eq.${user.id}${inviteCodeIds.length > 0 ? `,invite_code_id.in.(${inviteCodeIds.join(",")})` : ""}`);

    const orgUserIds = [...new Set([user.id, ...(orgUsers?.map(u => u.user_id) || [])])];
    console.log(`Admin organization has ${orgUserIds.length} users`);

    // ========== PROCESS REQUEST ==========
    const { startDate, endDate } = await req.json();
    console.log(`Exporting PDF, dates: ${startDate} - ${endDate}`);

    // ========== FETCH INTERVENTIONS ==========
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
      .in('created_by', orgUserIds)
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

    console.log(`Found ${interventions?.length || 0} interventions`);

    // Get profiles for response users
    const allResponseUserIds = new Set<string>();
    (interventions || []).forEach((intervention: any) => {
      (intervention.intervention_responses || []).forEach((r: any) => {
        if (r.user_id) allResponseUserIds.add(r.user_id);
      });
    });

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

    const typedInterventions: Intervention[] = (interventions || []).map((intervention: any) => ({
      ...intervention,
      intervention_responses: (intervention.intervention_responses || []).map((r: any) => ({
        ...r,
        profiles: { full_name: userProfilesMap[r.user_id] || null }
      }))
    }));

    // ========== GENERATE PDF AND RETURN AS BASE64 ==========
    const pdfBuffer = generatePDF(typedInterventions, startDate, endDate);
    const pdfBase64 = arrayBufferToBase64(pdfBuffer);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf: pdfBase64,
        filename: `historique-interventions-${new Date().toISOString().split('T')[0]}.pdf`,
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
