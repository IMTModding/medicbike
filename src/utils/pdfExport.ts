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

const urgencyLabels: Record<string, string> = {
  high: 'Urgent',
  medium: 'Moyen',
  low: 'Normal'
};

const statusLabels: Record<string, string> = {
  active: 'En cours',
  completed: 'Terminée'
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
