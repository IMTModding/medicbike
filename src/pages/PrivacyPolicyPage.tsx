import { ArrowLeft, Shield, Eye, Database, Clock, Mail, MapPin, Bell, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const lastUpdated = "20 janvier 2025";
  const companyName = "MEDICBIKE";
  const contactEmail = "contact@medicbike.fr";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border safe-area-top">
        <div className="container flex items-center gap-4 h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Politique de Confidentialité</h1>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 pb-safe-area max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Politique de Confidentialité - {companyName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : {lastUpdated}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Chez {companyName}, nous nous engageons à protéger votre vie privée et vos données personnelles 
              conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi française 
              Informatique et Libertés.
            </p>
          </CardContent>
        </Card>

        {/* Responsable du traitement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              1. Responsable du traitement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              <strong>Raison sociale :</strong> {companyName}
            </p>
            <p>
              <strong>Email de contact :</strong>{" "}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Données collectées */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              2. Données collectées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Données d'identification :</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Nom complet</li>
                <li>Adresse email professionnelle</li>
                <li>Numéro de téléphone</li>
                <li>Photo de profil (optionnelle)</li>
              </ul>
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Données de géolocalisation :
              </h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Position GPS (uniquement pendant les interventions actives)</li>
                <li>Horodatage des déplacements</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-3 rounded-md">
                ⚠️ <strong>Important :</strong> La géolocalisation n'est activée que lorsque vous êtes en route 
                vers une intervention. Aucun suivi permanent n'est effectué.
              </p>
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Données techniques :</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Adresse IP (partiellement masquée : seuls les 2 premiers octets sont conservés)</li>
                <li>Type d'appareil et navigateur</li>
                <li>Historique de connexion</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Finalités du traitement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              3. Finalités du traitement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full p-1 mt-0.5">
                  <Bell className="h-4 w-4" />
                </span>
                <div>
                  <strong>Gestion des interventions :</strong>
                  <p className="text-muted-foreground text-sm">
                    Coordination des équipes et suivi des interventions en temps réel
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full p-1 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <strong>Optimisation des trajets :</strong>
                  <p className="text-muted-foreground text-sm">
                    Navigation vers les lieux d'intervention et notification d'arrivée
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full p-1 mt-0.5">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <strong>Communication d'équipe :</strong>
                  <p className="text-muted-foreground text-sm">
                    Messagerie et notifications entre membres de l'organisation
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full p-1 mt-0.5">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <strong>Sécurité :</strong>
                  <p className="text-muted-foreground text-sm">
                    Détection d'activités suspectes et audit des connexions
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Base légale */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Base légale du traitement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Nous traitons vos données sur les bases légales suivantes :
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>
                <strong>Exécution du contrat</strong> : gestion de votre compte et des interventions
              </li>
              <li>
                <strong>Consentement</strong> : notifications push et géolocalisation
              </li>
              <li>
                <strong>Intérêt légitime</strong> : sécurité et amélioration du service
              </li>
              <li>
                <strong>Obligation légale</strong> : conservation des logs de connexion
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Conservation des données */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              5. Durée de conservation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Type de données</th>
                    <th className="text-left py-2 font-medium">Durée</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2">Données de compte</td>
                    <td className="py-2">Durée du compte + 3 ans</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Historique des interventions</td>
                    <td className="py-2">5 ans (obligation légale)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Données de géolocalisation</td>
                    <td className="py-2">90 jours</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Logs de connexion</td>
                    <td className="py-2">1 an</td>
                  </tr>
                  <tr>
                    <td className="py-2">Messages</td>
                    <td className="py-2">2 ans</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Vos droits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">6. Vos droits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: "Droit d'accès", desc: "Obtenir une copie de vos données" },
                { title: "Droit de rectification", desc: "Corriger vos données inexactes" },
                { title: "Droit à l'effacement", desc: "Supprimer vos données" },
                { title: "Droit à la portabilité", desc: "Récupérer vos données" },
                { title: "Droit d'opposition", desc: "Refuser certains traitements" },
                { title: "Droit à la limitation", desc: "Geler le traitement" },
              ].map((right) => (
                <div key={right.title} className="bg-muted/50 p-3 rounded-lg">
                  <h4 className="font-medium text-sm">{right.title}</h4>
                  <p className="text-xs text-muted-foreground">{right.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Pour exercer vos droits, contactez-nous à{" "}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Sécurité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              7. Mesures de sécurité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Chiffrement des données en transit (HTTPS/TLS)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Chiffrement des données au repos
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Authentification à deux facteurs disponible
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Masquage des adresses IP
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Contrôle d'accès basé sur les rôles (RBAC)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Isolation des données sensibles
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Audits de sécurité réguliers
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              8. Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Pour toute question concernant cette politique ou vos données personnelles :
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium">{companyName}</p>
              <p className="text-muted-foreground">
                Email :{" "}
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                  {contactEmail}
                </a>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Vous avez également le droit d'introduire une réclamation auprès de la CNIL :{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                www.cnil.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PrivacyPolicyPage;
