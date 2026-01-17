export interface Intervention {
  id: string;
  title: string;
  location: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  createdAt: Date;
  status?: 'pending' | 'available' | 'unavailable';
}

export const mockInterventions: Intervention[] = [
  {
    id: '1',
    title: 'Fuite d\'eau urgente',
    location: '15 Rue de la Paix, Paris 75002',
    description: 'Fuite importante dans la cuisine. Intervention immédiate requise.',
    urgency: 'high',
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: '2',
    title: 'Panne électrique',
    location: '42 Avenue des Champs-Élysées, Paris 75008',
    description: 'Coupure de courant dans l\'immeuble. Vérification du tableau électrique nécessaire.',
    urgency: 'medium',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: '3',
    title: 'Entretien climatisation',
    location: '8 Boulevard Haussmann, Paris 75009',
    description: 'Maintenance préventive du système de climatisation.',
    urgency: 'low',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '4',
    title: 'Serrure bloquée',
    location: '23 Rue du Faubourg Saint-Honoré, Paris 75008',
    description: 'Client bloqué à l\'extérieur. Remplacement de serrure urgent.',
    urgency: 'high',
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
  },
];
