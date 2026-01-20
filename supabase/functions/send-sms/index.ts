import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSPayload {
  interventionId: string;
  title: string;
  location: string;
  urgency: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.log("Twilio not configured, skipping SMS");
      return new Response(
        JSON.stringify({ success: false, message: "SMS non configuré" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { interventionId, title, location, urgency }: SMSPayload = await req.json();

    // Only send SMS for high urgency interventions
    if (urgency !== "high") {
      return new Response(
        JSON.stringify({ success: true, message: "SMS non envoyé (urgence non critique)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get intervention to find the creator
    const { data: intervention } = await supabase
      .from("interventions")
      .select("created_by")
      .eq("id", interventionId)
      .single();

    if (!intervention) {
      throw new Error("Intervention not found");
    }

    // Get organization info from creator
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("admin_id, invite_code_id")
      .eq("user_id", intervention.created_by)
      .single();

    // Get organization member user_ids first
    let memberUserIds: string[] = [];
    
    if (creatorProfile?.invite_code_id) {
      const { data: members } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("invite_code_id", creatorProfile.invite_code_id);
      memberUserIds = members?.map(m => m.user_id) || [];
    } else if (creatorProfile?.admin_id) {
      const { data: members } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("admin_id", creatorProfile.admin_id);
      memberUserIds = members?.map(m => m.user_id) || [];
    }

    if (memberUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucun membre trouvé", sentCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get phone numbers from profile_contacts table (not profiles)
    const { data: contacts, error: contactsError } = await supabase
      .from("profile_contacts")
      .select("phone, user_id")
      .in("user_id", memberUserIds)
      .not("phone", "is", null);

    if (contactsError) {
      throw contactsError;
    }

    // Get full names for the contacts
    const contactUserIds = contacts?.map(c => c.user_id) || [];
    const { data: profileNames } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", contactUserIds);

    const nameMap = new Map(profileNames?.map(p => [p.user_id, p.full_name]) || []);

    const urgencyLabel = urgency === "high" ? "🚨 URGENT" : urgency === "medium" ? "⚠️ Moyen" : "ℹ️ Normal";
    const message = `${urgencyLabel}\n\nNouvelle intervention MedicBike:\n📍 ${location}\n📋 ${title}\n\nConnectez-vous à l'app pour répondre.`;

    let sentCount = 0;
    const errors: string[] = [];

    // Send SMS to each team member with a phone number
    for (const contact of contacts || []) {
      if (!contact.phone) continue;

      // Clean phone number (ensure it has country code)
      let phoneNumber = contact.phone.replace(/\s+/g, "");
      if (!phoneNumber.startsWith("+")) {
        // Assume French number if no country code
        phoneNumber = phoneNumber.startsWith("0") 
          ? "+33" + phoneNumber.substring(1) 
          : "+33" + phoneNumber;
      }

      const fullName = nameMap.get(contact.user_id) || phoneNumber;

      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        
        const formData = new URLSearchParams();
        formData.append("To", phoneNumber);
        formData.append("From", twilioPhoneNumber);
        formData.append("Body", message);

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        if (response.ok) {
          sentCount++;
          console.log(`SMS sent to ${fullName}`);
        } else {
          const errorData = await response.json();
          errors.push(`${phoneNumber}: ${errorData.message || "Erreur inconnue"}`);
          console.error(`Failed to send SMS to ${phoneNumber}:`, errorData);
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Erreur inconnue';
        errors.push(`${phoneNumber}: ${errMsg}`);
        console.error(`Error sending SMS to ${phoneNumber}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        totalRecipients: contacts?.length || 0,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-sms function:", error);
    const errMsg = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
