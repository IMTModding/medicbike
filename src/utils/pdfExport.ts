import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface InterventionData {
  id: string;
  title: string;
  location: string;
  urgency: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
}

interface StatsData {
  totalInterventions: number;
  completedInterventions: number;
  activeInterventions: number;
  totalResponses: number;
  availableResponses: number;
  responseRate: number;
  urgencyDistribution: { name: string; value: number }[];
}

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  event_date: string;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  status: string;
}

interface EventAvailability {
  user_id: string;
  status: 'available' | 'maybe' | 'unavailable';
  notes?: string | null;
}

interface ProfileInfo {
  full_name: string | null;
  avatar_url: string | null;
}

const urgencyLabels: Record<string, string> = {
  high: 'Urgent',
  medium: 'Moyen',
  low: 'Normal'
};

const statusLabels: Record<string, string> = {
  active: 'En cours',
  completed: 'Terminée'
};

const eventStatusLabels: Record<string, string> = {
  upcoming: 'À venir',
  ongoing: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé'
};

const availabilityLabels: Record<string, string> = {
  available: 'Disponible',
  maybe: 'Peut-être',
  unavailable: 'Indisponible'
};

export const exportEventPDF = (
  event: EventData,
  availabilities: EventAvailability[],
  profiles: Map<string, ProfileInfo>
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header with colored bar
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Fiche Événement', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(10);
  const generatedDate = format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr });
  doc.text(`Généré le ${generatedDate}`, pageWidth / 2, 28, { align: 'center' });
  
  // Event details section
  let yPos = 50;
  
  doc.setFontSize(18);
  doc.setTextColor(33, 37, 41);
  doc.text(event.title, 14, yPos);
  yPos += 8;
  
  // Status badge
  doc.setFontSize(10);
  doc.setTextColor(108, 117, 125);
  doc.text(`Statut: ${eventStatusLabels[event.status] || event.status}`, 14, yPos);
  yPos += 12;
  
  // Event info table
  const eventDate = new Date(event.event_date);
  const eventInfo = [
    ['📅 Date', format(eventDate, 'EEEE d MMMM yyyy', { locale: fr })],
    ['🕐 Horaires', event.end_time 
      ? `${event.start_time.slice(0, 5)} - ${event.end_time.slice(0, 5)}` 
      : event.start_time.slice(0, 5)
    ],
  ];
  
  if (event.location) {
    eventInfo.push(['📍 Lieu', event.location]);
  }
  
  if (event.description) {
    eventInfo.push(['📝 Description', event.description]);
  }
  
  autoTable(doc, {
    startY: yPos,
    body: eventInfo,
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 'auto' }
    }
  });
  
  // Participants summary
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  const availableCount = availabilities.filter(a => a.status === 'available').length;
  const maybeCount = availabilities.filter(a => a.status === 'maybe').length;
  const unavailableCount = availabilities.filter(a => a.status === 'unavailable').length;
  
  doc.setFontSize(14);
  doc.setTextColor(33, 37, 41);
  doc.text('Résumé des Disponibilités', 14, yPos);
  yPos += 6;
  
  const summaryData = [
    ['✅ Disponibles', availableCount.toString()],
    ['❓ Peut-être', maybeCount.toString()],
    ['❌ Indisponibles', unavailableCount.toString()],
    ['👥 Total réponses', availabilities.length.toString()],
  ];
  
  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 11, cellPadding: 5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'center', cellWidth: 30 }
    }
  });
  
  // Participants list
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.setTextColor(33, 37, 41);
  doc.text('Liste des Participants', 14, yPos);
  
  if (availabilities.length > 0) {
    // Sort by status: available first, then maybe, then unavailable
    const sortedAvailabilities = [...availabilities].sort((a, b) => {
      const order = { available: 0, maybe: 1, unavailable: 2 };
      return order[a.status] - order[b.status];
    });
    
    const participantRows = sortedAvailabilities.map(a => {
      const profile = profiles.get(a.user_id);
      const name = profile?.full_name || 'Utilisateur inconnu';
      const status = availabilityLabels[a.status] || a.status;
      return [name, status, a.notes || '-'];
    });
    
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Nom', 'Statut', 'Notes']],
      body: participantRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 'auto' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const status = data.cell.raw as string;
          if (status === 'Disponible') {
            data.cell.styles.textColor = [22, 163, 74]; // green
          } else if (status === 'Peut-être') {
            data.cell.styles.textColor = [202, 138, 4]; // yellow
          } else if (status === 'Indisponible') {
            data.cell.styles.textColor = [220, 38, 38]; // red
          }
        }
      }
    });
  } else {
    yPos += 8;
    doc.setFontSize(11);
    doc.setTextColor(108, 117, 125);
    doc.text('Aucun participant inscrit.', 14, yPos);
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text('MedicBike - Fiche Événement', 14, pageHeight - 10);
  doc.text('Page 1 / 1', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Save
  const dateStr = format(eventDate, 'yyyy-MM-dd');
  const safeTitle = event.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30);
  const filename = `evenement-${safeTitle}-${dateStr}.pdf`;
  doc.save(filename);
};

export const exportStatsPDF = (stats: StatsData, interventions: InterventionData[], dateRange?: { start: Date; end: Date }) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(33, 37, 41);
  doc.text('Rapport de Statistiques', pageWidth / 2, 20, { align: 'center' });
  
  // Date info
  doc.setFontSize(10);
  doc.setTextColor(108, 117, 125);
  const generatedDate = format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr });
  doc.text(`Généré le ${generatedDate}`, pageWidth / 2, 28, { align: 'center' });
  
  if (dateRange) {
    const rangeText = `Période: ${format(dateRange.start, 'dd/MM/yyyy')} - ${format(dateRange.end, 'dd/MM/yyyy')}`;
    doc.text(rangeText, pageWidth / 2, 34, { align: 'center' });
  }
  
  // KPI Section
  doc.setFontSize(14);
  doc.setTextColor(33, 37, 41);
  doc.text('Indicateurs Clés', 14, 48);
  
  // KPI boxes
  const kpiData = [
    ['Total Interventions', stats.totalInterventions.toString()],
    ['Terminées', stats.completedInterventions.toString()],
    ['En cours', stats.activeInterventions.toString()],
    ['Taux de disponibilité', `${stats.responseRate}%`],
  ];
  
  autoTable(doc, {
    startY: 52,
    head: [['Indicateur', 'Valeur']],
    body: kpiData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 11, cellPadding: 5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' }
    }
  });
  
  // Urgency Distribution
  const urgencyY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text('Répartition par Urgence', 14, urgencyY);
  
  const urgencyData = stats.urgencyDistribution.map(item => [
    item.name,
    item.value.toString(),
    `${stats.totalInterventions > 0 ? Math.round((item.value / stats.totalInterventions) * 100) : 0}%`
  ]);
  
  autoTable(doc, {
    startY: urgencyY + 4,
    head: [['Niveau', 'Nombre', 'Pourcentage']],
    body: urgencyData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 11, cellPadding: 5 },
  });
  
  // Response Summary
  const responseY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text('Résumé des Réponses', 14, responseY);
  
  const responseData = [
    ['Total réponses', stats.totalResponses.toString()],
    ['Disponibles', stats.availableResponses.toString()],
    ['Indisponibles', (stats.totalResponses - stats.availableResponses).toString()],
  ];
  
  autoTable(doc, {
    startY: responseY + 4,
    head: [['Type', 'Nombre']],
    body: responseData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 11, cellPadding: 5 },
  });
  
  // Interventions List (new page)
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Liste des Interventions', 14, 20);
  
  const interventionRows = interventions.map(int => [
    int.title,
    int.location,
    urgencyLabels[int.urgency] || int.urgency,
    statusLabels[int.status] || int.status,
    format(new Date(int.created_at), 'dd/MM/yyyy HH:mm'),
    int.completed_at ? format(new Date(int.completed_at), 'dd/MM/yyyy HH:mm') : '-'
  ]);
  
  autoTable(doc, {
    startY: 25,
    head: [['Titre', 'Lieu', 'Urgence', 'Statut', 'Créée le', 'Terminée le']],
    body: interventionRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
    }
  });
  
  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    doc.text('MedicBike - Rapport de Statistiques', 14, doc.internal.pageSize.getHeight() - 10);
  }
  
  // Save
  const filename = `rapport-statistiques-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(filename);
};
