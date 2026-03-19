import jsPDF from 'jspdf';

export const COLOR = {
  navy: [4, 44, 94] as [number, number, number],
  teal: [29, 160, 186] as [number, number, number],
  green: [40, 167, 69] as [number, number, number],
  red: [220, 53, 69] as [number, number, number],
  amber: [255, 193, 7] as [number, number, number],
  gray1: [48, 58, 76] as [number, number, number],
  gray2: [108, 117, 125] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  graylt: [248, 249, 250] as [number, number, number],
  graybd: [222, 226, 230] as [number, number, number],
};

export const pageSize = (doc: jsPDF) => ({
  width: doc.internal.pageSize.getWidth(),
  height: doc.internal.pageSize.getHeight(),
});

export const parseIsoDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const drawAtlasMark = (doc: jsPDF, x: number, y: number, scale = 1): void => {
  doc.setFillColor(...COLOR.teal);
  doc.triangle(x, y + 10 * scale, x + 14 * scale, y - 14 * scale, x + 28 * scale, y + 10 * scale, 'F');
  doc.setFillColor(...COLOR.white);
  doc.triangle(x + 7 * scale, y + 4 * scale, x + 14 * scale, y - 7 * scale, x + 21 * scale, y + 4 * scale, 'F');
};

export function drawHeader(doc: jsPDF, titulo: string, subtitulo: string, pagina: number, total: number): void {
  const { width } = pageSize(doc);
  doc.setFillColor(...COLOR.navy);
  doc.rect(0, 0, width, 22, 'F');

  drawAtlasMark(doc, 12, 11, 0.6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLOR.white);
  doc.text('ATLAS Horizon', 34, 11);

  doc.setFontSize(13);
  doc.text(titulo, 14, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.gray2);
  doc.text(subtitulo, 14, 38);
  doc.text(`Página ${pagina} de ${total}`, width - 14, 38, { align: 'right' });
}

export function drawFooter(doc: jsPDF): void {
  const { width, height } = pageSize(doc);
  doc.setFillColor(...COLOR.navy);
  doc.rect(0, height - 14, width, 14, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.white);
  doc.text('ATLAS Horizon · Uso confidencial', 14, height - 5.5);
  doc.text('atlas.app/horizon', width - 14, height - 5.5, { align: 'right' });
}

export function drawKpiRow(
  doc: jsPDF,
  y: number,
  items: Array<{ label: string; value: string; sub: string; color: [number, number, number] }>,
): number {
  const { width } = pageSize(doc);
  const margin = 14;
  const gap = 4;
  const perRow = Math.max(1, Math.min(5, items.length));
  const cardWidth = (width - margin * 2 - gap * (perRow - 1)) / perRow;
  const cardHeight = 22;

  items.forEach((item, index) => {
    const x = margin + index * (cardWidth + gap);
    doc.setDrawColor(...COLOR.graybd);
    doc.setFillColor(...COLOR.graylt);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFillColor(...item.color);
    doc.roundedRect(x, y, 3, cardHeight, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.gray2);
    doc.text(item.label, x + 6, y + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLOR.gray1);
    doc.text(item.value, x + 6, y + 13.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.gray2);
    doc.text(item.sub, x + 6, y + 19);
  });

  return y + cardHeight + 6;
}

export function drawSectionTitle(doc: jsPDF, y: number, label: string): number {
  const { width } = pageSize(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR.gray1);
  doc.text(label, 14, y);

  doc.setDrawColor(...COLOR.teal);
  doc.setLineWidth(0.7);
  doc.line(14, y + 2.5, width - 14, y + 2.5);
  return y + 8;
}

export function fmtEur(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fmtPct(n: number, dec = 2): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(Number.isFinite(n) ? n : 0)}%`;
}
