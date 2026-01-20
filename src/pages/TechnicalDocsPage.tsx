import { ArrowLeft, Code, Database, Shield, Server, Smartphone, FileText, Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const TechnicalDocsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border safe-area-top">
        <div className="container flex items-center gap-4 h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Documentation Technique</h1>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 pb-safe-area max-w-4xl mx-auto space-y-6">
        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-6 w-6 text-primary" />
              MEDICBIKE - Vue d'ensemble
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Application de gestion d'interventions médicales à vélo. Permet la coordination 
              d'équipes, le suivi en temps réel des interventions, et la communication entre membres.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">React 18</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">Tailwind CSS</Badge>
              <Badge variant="secondary">Supabase</Badge>
              <Badge variant="secondary">PWA</Badge>
              <Badge variant="secondary">Capacitor</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Architecture */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Architecture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{`┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React PWA)                    │
├─────────────────────────────────────────────────────────┤
│  Components  │  Pages  │  Hooks  │  Contexts  │ Services │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE (Backend)                      │
├─────────────────────────────────────────────────────────┤
│  Auth  │  Database  │  Storage  │  Edge Functions  │ RT  │
└─────────────────────────────────────────────────────────┘`}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Database Schema */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Schéma de Base de Données
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { name: "profiles", desc: "Informations utilisateurs", rls: true },
                { name: "profile_contacts", desc: "Données sensibles (email, téléphone)", rls: true },
                { name: "user_roles", desc: "Rôles (admin/employee)", rls: true },
                { name: "interventions", desc: "Alertes et interventions", rls: true },
                { name: "intervention_responses", desc: "Réponses aux alertes", rls: true },
                { name: "intervention_messages", desc: "Chat par intervention", rls: true },
                { name: "general_messages", desc: "Chat général organisation", rls: true },
                { name: "vehicles", desc: "Flotte de véhicules", rls: true },
                { name: "availabilities", desc: "Disponibilités employés", rls: true },
                { name: "invite_codes", desc: "Codes d'invitation", rls: true },
                { name: "login_history", desc: "Historique connexions (IP masquée)", rls: true },
                { name: "push_subscriptions", desc: "Abonnements notifications", rls: true },
              ].map((table) => (
                <div key={table.name} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-medium">{table.name}</code>
                    {table.rls && (
                      <Badge variant="outline" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        RLS
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{table.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium">Row Level Security (RLS)</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Toutes les tables ont RLS activé</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Accès anonyme refusé sur tables sensibles</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Isolation des données par organisation</span>
                </li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Protection des données</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Contacts isolés dans table séparée (profile_contacts)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>IP masquées automatiquement (seuls 2 premiers octets)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Authentification 2FA disponible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>GPS uniquement pendant interventions actives</span>
                </li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Fonctions SECURITY DEFINER</h4>
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <ul className="space-y-1 font-mono text-xs">
                  <li>• get_user_profile_access()</li>
                  <li>• get_organization_profiles()</li>
                  <li>• validate_invite_code()</li>
                  <li>• has_role()</li>
                  <li>• mask_ip_address()</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edge Functions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Edge Functions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {[
                { name: "send-push-notification", desc: "Envoi notifications push web" },
                { name: "vapid-public-key", desc: "Clé publique VAPID pour push" },
                { name: "invite-user", desc: "Invitation d'utilisateurs par admin" },
                { name: "delete-user", desc: "Suppression de compte (admin)" },
                { name: "reset-user-password", desc: "Réinitialisation mot de passe" },
                { name: "update-user-role", desc: "Modification des rôles" },
                { name: "send-password-recovery", desc: "Email récupération mot de passe" },
                { name: "export-history", desc: "Export CSV/PDF des interventions" },
                { name: "send-sms", desc: "SMS pour alertes haute urgence" },
              ].map((fn) => (
                <div key={fn.name} className="flex items-center justify-between border rounded-lg p-3">
                  <code className="text-sm">{fn.name}</code>
                  <span className="text-xs text-muted-foreground">{fn.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mobile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Compatibilité Mobile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">PWA (Web)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Installation sur écran d'accueil</li>
                  <li>• Notifications push</li>
                  <li>• Mode hors-ligne partiel</li>
                  <li>• Safe Area support</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Capacitor (Natif)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Build Android APK</li>
                  <li>• Build iOS IPA</li>
                  <li>• Géolocalisation background</li>
                  <li>• Intégration native</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Environment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Variables d'environnement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <pre>{`# Frontend (public)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Backend (secrets - Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=***
VAPID_PUBLIC_KEY=***
VAPID_PRIVATE_KEY=***
RESEND_API_KEY=***`}</pre>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TechnicalDocsPage;
